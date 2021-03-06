import { graphql } from "@octokit/graphql";
import type { IssueState, Project, Repository } from "@octokit/graphql-schema";
import { PullRequestState } from "@octokit/graphql-schema/schema";
import { debug } from "@deps/debug";
import { mdEscape, mdLink } from "markdown-function";

export interface fetchProjectBoardOptions {
    owner: string;
    repo: string;
    projectNumber: number;
    token: string;
}

export interface ProjectBoardItem {
    __typename: "Issue" | "PullRequest";
    id: string; // GitHub Node id
    title: string;
    url: string;
    body: string;
    labels: {
        nodes: {
            name: string;
            description: string;
        }[];
    };
    state: "OPEN" | "CLOSED";
}

export interface ProjectBoardColumn {
    name: string;
    items: ProjectBoardItem[];
}

export interface ProjectBoard {
    name: string;
    columns: ProjectBoardColumn[];
}

export const normalizeProject = (project: Project): ProjectBoard => {
    const columns = project.columns?.edges?.map((column) => {
        let columnNode = column?.node;
        return {
            name: columnNode?.name,
            items: columnNode?.cards?.nodes
                ?.filter((card) => {
                    return card?.content && !card.isArchived;
                })
                .map((card) => {
                    const content = card?.content;
                    const state = (() => {
                        const state: PullRequestState | IssueState =
                            (content as any)?.IssueState || (content as any)?.PullRequestState;
                        if (state === "CLOSED" || state === "MERGED") {
                            return "CLOSED";
                        }
                        return "OPEN";
                    })();
                    return {
                        __typename: content?.__typename,
                        id: content?.id,
                        title: content?.title,
                        url: content?.url,
                        body: content?.body,
                        labels: content?.labels,
                        state: state
                    };
                })
        };
    }) as ProjectBoardColumn[];
    return {
        name: project.name,
        columns
    };
};
export type toMarkdownOptions = {
    /**
     * If you want to treat https://example.com/a as https://example.com/b
     * itemMapping: (item) => { ...item, url: item.url.replace("/a", "/b") }
     * @param url
     */
    itemMapping?: (item: ProjectBoardItem) => ProjectBoardItem;
};
export const toMarkdown = (projectBoard: ProjectBoard, options?: toMarkdownOptions): string => {
    const check = (item: ProjectBoardItem) => {
        return item.state === "OPEN" ? `[ ]` : "[x]";
    };
    const itemMapping = options?.itemMapping ? options.itemMapping : (item: ProjectBoardItem) => item;
    return (
        projectBoard.columns
            .map((column) => {
                return (
                    `## ${mdEscape(column.name)}\n\n` +
                    column.items
                        .map((item) => {
                            const mappedItem = itemMapping(item);
                            return `- ${check(mappedItem)} ${mdLink({
                                text: mappedItem.title,
                                url: mappedItem.url
                            })}\n`;
                        })
                        .join("\n")
                );
            })
            .join("\n")
            .trim() + "\n"
    );
};
export const fetchProjectBoard = async (options: fetchProjectBoardOptions): Promise<ProjectBoard> => {
    const query = `query($owner: String!, $repo: String!, $projectNumber: Int!){
  repository(owner: $owner name: $repo) {
    project(number: $projectNumber) {
      name
      columns(first: 20) {
        edges {
          node {
            name
            cards {
              nodes {
                id
                note
                isArchived
                content {
                  __typename
                  ... on Issue {
                    id
                    title
                    url
                    body
                    labels(first: 10) {
                      nodes {
                        name
                        description
                      }
                    }
                    IssueState: state
                  }
                  ... on PullRequest {
                    id
                    title
                    url
                    body
                    labels(first: 10) {
                      nodes {
                        name
                        description
                      }
                    }
                    PullRequestState: state
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;
    debug("options", options);
    const res = await graphql<{
        repository: Repository;
    }>(query, {
        headers: {
            authorization: `token ${options.token}`
        },
        owner: options.owner,
        repo: options.repo,
        projectNumber: options.projectNumber
    });
    if (!res.repository.project) {
        throw new Error("Not found project");
    }
    return normalizeProject(res.repository.project);
};
