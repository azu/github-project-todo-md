import unified from "unified";
import parse from "remark-parse";
import gfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { select, selectAll } from "unist-util-select";
import { debug } from "@deps/debug";
import { graphql } from "@octokit/graphql";
import { fetchProjectBoard, ProjectBoardItem } from "./project-to-markdown";
import { dedent } from "ts-dedent";
const md = unified()
    .use(parse)
    .use(remarkStringify, {
        bullet: "-",
        fences: true,
        incrementListMarker: true
    })
    .use(gfm);

type SyncIssuesParam =
    | {
          __typename: "Issue" | "PullRequest" | "ProjectCard";
          id: string; // GraphQL id!
          state: "OPEN" | "CLOSED";
      }
    | {
          __typename: "NewProjectCard";
          columnId: string;
          title: string;
          body: string;
      };

export type SyncTaskItem = { state: "OPEN" | "CLOSED"; title: string; url?: string };

export interface SyncToProjectOptions {
    owner: string;
    repo: string;
    projectNumber: number;
    token: string;
    /**
     * - [x] [title](https://example/a)
     *
     * If you want to treat /a as /b
     * https://example/a → https://example/b
     *
     * itemMapping: (item) => { ...item, url: item.url.replace("/a", "/b") }
     * @param url
     */
    itemMapping?: (item: SyncTaskItem) => SyncTaskItem;
    /**
     * Include note only card on syncing target
     * Default: false
     */
    includesNote?: boolean;
}

export const syncIssues = async (queryParams: SyncIssuesParam[], options: SyncToProjectOptions): Promise<void> => {
    if (queryParams.length === 0) {
        return;
    }
    const queries = queryParams.map((param, index) => {
        if (param.__typename === "NewProjectCard") {
            // note insert
            return `
            newProjectCart${index}: addProjectCard(input: {
    projectColumnId: "${param.columnId}"
    note: ${JSON.stringify(param.title + (param.body ? "\n\n" + param.body : ""))}
  }){
    clientMutationId
  }`;
        } else if (param.__typename === "ProjectCard") {
            // archive note
            return `updateProjectCard(input: {
                projectCardId: "${param.id}"
                isArchived: true
            }) {
                clientMutationId
            }`;
        } else if (param.__typename === "Issue") {
            if (param.state === "OPEN") {
                return `
  reopenIssue${index}: reopenIssue(input: {issueId: "${param.id}" }) {
    issue {
      url
    }
  }
`;
            } else if (param.state === "CLOSED") {
                return `
  closeIssue${index}: closeIssue(input: {issueId: "${param.id}" }) {
    issue {
      url
    }
  }
`;
            }
        } else if (param.__typename === "PullRequest") {
            // PR
            if (param.state === "OPEN") {
                return `
  reopenPR${index}: reopenPullRequest(input: {pullRequestId: "${param.id}" }) {
    issue {
      url
    }
  }
`;
            } else if (param.state === "CLOSED") {
                return `
  closePR${index}: closePullRequest(input: {pullRequestId: "${param.id}" }) {
    issue {
      url
    }
  }
`;
            }
        }
        throw new Error("Unknown state:" + JSON.stringify(param));
    });

    const syncQuery = `mutation { ${queries.join("\n")} }`;
    console.log(syncQuery);
    debug("sync query", syncQuery);
    return graphql<{
        [index: string]: any;
    }>(syncQuery, {
        headers: {
            authorization: `token ${options.token}`
        }
    }).then((data) => {
        if (Object.keys(data).length !== queryParams.length) {
            throw new Error("Something wrong response:" + JSON.stringify(data));
        }
    });
};
type TodoItem =
    | {
          type: "ISSUE_PR";
          state: "OPEN" | "CLOSED";
          title: string;
          body: string;
          url: string;
      }
    | {
          type: "Note";
          state: "OPEN" | "CLOSED";
          title: string;
          body: string;
          url: undefined;
      };
/**
 * Create Request Object for syncing state
 * @param markdown
 * @param options
 */
export const createSyncRequestObject = async (markdown: string, options: SyncToProjectOptions) => {
    const tree = md.parse(markdown);
    const listItems = selectAll("root > list > listItem[checked]", tree);
    const todoItems: TodoItem[] = listItems.map((item) => {
        const todoText = md.stringify(item);
        const lines = todoText.split(/\r?\n/);
        const title = lines[0].replace(/^-\s+\[.*?]\s*/, "");
        const body = dedent(lines.slice(1).join("\n"));
        const url = select("link", item)?.url;
        return {
            type: url ? "ISSUE_PR" : "Note",
            state: item.checked ? "CLOSED" : "OPEN",
            title: title,
            body: body,
            url: url
        } as TodoItem;
    });
    const project = await fetchProjectBoard(options);
    const needToUpdateItems: SyncIssuesParam[] = [];
    const itemMapping = options.itemMapping ? options.itemMapping : (item: SyncTaskItem) => item;
    const findProjectTodoItem = (todoItem: TodoItem): { columnId: string; item: ProjectBoardItem } | undefined => {
        for (const column of project.columns) {
            for (const columnItem of column.items) {
                const syncTaskItem = itemMapping(todoItem);
                if (syncTaskItem.url === columnItem.url) {
                    return {
                        item: columnItem,
                        columnId: column.id
                    };
                } else if (syncTaskItem.title === columnItem.title) {
                    return {
                        item: columnItem,
                        columnId: column.id
                    };
                }
            }
        }
        return;
    };
    for (const todoItem of todoItems) {
        const projectItem = findProjectTodoItem(todoItem);
        if (!projectItem) {
            // Should add new item as note
            if (options.includesNote && todoItem.type === "Note" && todoItem.state === "OPEN") {
                needToUpdateItems.push({
                    __typename: "NewProjectCard",
                    columnId: project.columns[0].id, // FIXME: only insert first column…
                    title: todoItem.title,
                    body: todoItem.body
                });
            }
            continue; // New Item?
        }
        const needToUpdateItem = todoItem.state !== projectItem.item.state;
        if (needToUpdateItem) {
            needToUpdateItems.push({
                __typename: projectItem.item.__typename,
                id: projectItem.item.id,
                state: todoItem.state
            });
        }
    }
    return needToUpdateItems;
};
// Markdown to Project
// state is based on Markdown
export const syncToProject = async (markdown: string, options: SyncToProjectOptions) => {
    const updateItems = await createSyncRequestObject(markdown, options);
    debug("updateItems", updateItems);
    return syncIssues(updateItems, options);
};
