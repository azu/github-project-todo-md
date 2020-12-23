import unified from "unified";
import parse from "remark-parse";
import gfm from "remark-gfm";
import { select, selectAll } from "unist-util-select";
import { debug } from "@deps/debug";
import { graphql } from "@octokit/graphql";
import { fetchProjectBoard } from "./project-to-markdown";

const md = unified().use(parse).use(gfm);

type syncIssuesParam = {
    __typename: "Issue" | "PullRequest";
    id: string; // GraphQL id!
    state: "OPEN" | "CLOSED";
};

export interface syncToProjectOptions {
    owner: string;
    repo: string;
    projectNumber: number;
    token: string;
}

export const syncIssues = async (queryParams: syncIssuesParam[], options: syncToProjectOptions): Promise<void> => {
    if (queryParams.length === 0) {
        return;
    }
    const queries = queryParams.map((param, index) => {
        if (param.__typename === "Issue") {
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
/**
 * Create Request Object for syncing state
 * @param markdown
 * @param options
 */
export const createSyncRequestObject = async (markdown: string, options: syncToProjectOptions) => {
    const tree = md.parse(markdown);
    const listItems = selectAll("root > list > listItem[checked]", tree);
    const todoItems = listItems.map((item) => {
        return {
            state: item.checked ? "CLOSED" : "OPEN",
            url: select("link", item)?.url
        } as {
            state: "OPEN" | "CLOSED";
            url: string;
        };
    });
    const project = await fetchProjectBoard(options);
    const needToUpdateItems: syncIssuesParam[] = [];
    project.columns.forEach((column) => {
        column.items.forEach((item) => {
            const todoItem = todoItems.find((todoItem) => todoItem.url === item.url);
            if (!todoItem) {
                return; // New Item?
            }
            const needToUpdateItem = todoItem.state !== item.state;
            if (needToUpdateItem) {
                console.log(item);
                needToUpdateItems.push({
                    __typename: item.__typename,
                    id: item.id,
                    state: todoItem.state
                });
            }
        });
    });
    return needToUpdateItems;
};
// Markdown to Project
// state is based on Markdown
export const syncToProject = async (markdown: string, options: syncToProjectOptions) => {
    const updateItems = await createSyncRequestObject(markdown, options);
    return syncIssues(updateItems, options);
};
