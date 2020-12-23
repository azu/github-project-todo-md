import { fetchProjectBoard, toMarkdown } from "../src/project-to-markdown";
import assert from "assert";

const TOKEN = process.env.GITHUB_TOKEN as string;
describe("project-to-markdown", function () {
    it("should fetch project board as markdown", async () => {
        const json = await fetchProjectBoard({
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN
        });
        const markdown = toMarkdown(json);
        assert.deepStrictEqual(json, {
            name: "Example",
            columns: [
                {
                    name: "To do",
                    items: [
                        {
                            __typename: "Issue",
                            id: "MDU6SXNzdWU3NzM3MjczODE=",
                            title: "TODO ISSUE",
                            url: "https://github.com/azu/github-project-todo-md/issues/4",
                            state: "OPEN"
                        }
                    ]
                },
                {
                    name: "In progress",
                    items: [
                        {
                            __typename: "Issue",
                            id: "MDU6SXNzdWU3NzM3MjY5OTA=",
                            title: "PROGRESS ISSUE",
                            url: "https://github.com/azu/github-project-todo-md/issues/3",
                            state: "OPEN"
                        }
                    ]
                },
                {
                    name: "Done",
                    items: [
                        {
                            __typename: "Issue",
                            id: "MDU6SXNzdWU3NzM3Mjc5MTA=",
                            title: "DONE ISSUE",
                            url: "https://github.com/azu/github-project-todo-md/issues/5",
                            state: "CLOSED"
                        }
                    ]
                }
            ]
        });
        assert.strictEqual(
            markdown,
            `## To do

- [ ] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)


## In progress

- [ ] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)


## Done

- [x] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`
        );
    });
});
