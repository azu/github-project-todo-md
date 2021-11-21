import { graphql } from "@octokit/graphql";
import type { IssueState, Organization, Project, Repository, User } from "@octokit/graphql-schema";
import { PullRequestState } from "@octokit/graphql-schema/schema";
import { debug } from "@deps/debug";
import { mdEscape, mdLink } from "markdown-function";

export interface FetchProjectBoardOptions {
    owner: string;
    repo: string;
    projectNumber: number;
    token: string;
    /**
     * Include note only card on syncing target
     * Default: false
     */
    includesNote?: boolean;
}

export interface ProjectBoardItem {
    __typename: "Issue" | "PullRequest" | "ProjectCard";
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
    id: string;
    name: string;
    items: ProjectBoardItem[];
}

export interface ProjectBoard {
    name: string;
    columns: ProjectBoardColumn[];
}

// const isNoteCard = (card: ProjectCard | null) => {
//     return Boolean(card?.note);
// };
export const normalizeProject = (project: Project, options: FetchProjectBoardOptions): ProjectBoard => {
    const columns = project.columns?.edges?.map((column) => {
        let columnNode = column?.node;
        return {
            id: columnNode?.id,
            name: columnNode?.name,
            items:
                columnNode?.cards?.nodes
                    ?.map((card) => {
                        // note
                        if (card?.note && card.content === null) {
                            const lines = card?.note.split(/\r?\n/) ?? [];
                            const title = lines[0];
                            const body = lines.slice(1).join("\n").trim();
                            return {
                                __typename: card?.__typename, // ProjectCard
                                id: card?.id,
                                title: title,
                                url: card?.url,
                                body: body,
                                labels: [],
                                state: card.isArchived ? "CLOSED" : "OPEN"
                            };
                        }
                        // issue or pr
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
                    .filter((card) => {
                        if (options.includesNote) {
                            return true;
                        }
                        return card.__typename !== "ProjectCard";
                    }) ?? []
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
                const columnBody =
                    `## ${mdEscape(column.name)}\n\n` +
                    column.items
                        .map((item) => {
                            const mappedItem = itemMapping(item);
                            // note
                            if (item.__typename === "ProjectCard") {
                                const body = mappedItem.body
                                    ? "\n" + mappedItem.body
                                    .split(/\r?\n/)
                                    .map((line) => " ".repeat(4) + line)
                                    .join("\n")
                                    : "";
                                return `- ${check(mappedItem)} ${mdLink({
                                    text: mappedItem.title,
                                    url: mappedItem.url
                                })}${body}`;
                            }
                            // issue
                            return `- ${check(mappedItem)} ${mdLink({
                                text: mappedItem.title,
                                url: mappedItem.url
                            })}`;
                        })
                        .join("\n");
                return columnBody + "\n";
            })
            .join("\n")
            .trim() + "\n"
    );
};
export const fetchProjectBoard = async (options: FetchProjectBoardOptions): Promise<ProjectBoard> => {
    const queryVariables = (() => {
        if (options.owner === "users" || options.owner === "orgs") {
            return "query($repo: String!, $projectNumber: Int!) ";
        }
        return "query($owner: String!, $repo: String!, $projectNumber: Int!) ";
    })();
    const targetQuery = (() => {
        if (options.owner === "users") {
            return "user(login: $repo) ";
        } else if (options.owner === "orgs") {
            return "organization(login: $repo) ";
        }
        return "repository(owner: $owner name: $repo) ";
    })();
    const query = `${queryVariables} {
  ${targetQuery} {
   project(number: $projectNumber) {
      name
      columns(first: 20) {
        edges {
          node {
            id
            
            name
            cards(archivedStates: NOT_ARCHIVED) {
              nodes {
                __typename
                id
                note
                url
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
        user: User;
        organization: Organization;
        repository: Repository;
    }>(query, {
        headers: {
            authorization: `token ${options.token}`,
            "GraphQL-Features": "projects_next_graphql"
        },
        owner: options.owner,
        repo: options.repo,
        projectNumber: options.projectNumber
    });
    const project = (() => {
        if (options.owner === "users") {
            return res.user.project;
        } else if (options.owner === "orgs") {
            return res.organization.project;
        }
        return res.repository.project;
    })();
    if (!project) {
        throw new Error("Not found project");
    }
    return normalizeProject(project, options);
};
