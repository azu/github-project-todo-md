import { graphql } from "@octokit/graphql";
import type { IssueState, Project, Repository } from "@octokit/graphql-schema";
import { PullRequestState } from "@octokit/graphql-schema/schema";
import { debug } from "@deps/debug";
// @ts-ignore
import * as markdown from "markdown-builder";

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
export const toMarkdown = (projectBoard: ProjectBoard): string => {
    const check = (item: ProjectBoardItem) => {
        return item.state === "OPEN" ? `[ ]` : "[x]";
    };
    return (
        projectBoard.columns
            .map((column) => {
                const columnName: string = markdown.headers.hX(2, column.name);

                return (
                    columnName +
                    "\n" +
                    column.items
                        .map((item) => {
                            return `- ${check(item)} ${markdown.misc.link(item.title, item.url)}`;
                        })
                        .join("\n")
                );
            })
            .join("\n\n")
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
                    IssueState: state
                  }
                  ... on PullRequest {
                    id
                    title
                    url
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
