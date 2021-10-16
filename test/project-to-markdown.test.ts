import { fetchProjectBoard, toMarkdown } from "../src/project-to-markdown";
import assert from "assert";

const TOKEN = process.env.GITHUB_TOKEN as string;
describe("project-to-markdown", function () {
    it("should fetch project board as markdown", async () => {
        const json = await fetchProjectBoard({
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN,
            includesNote: true
        });
        const markdown = toMarkdown(json);
        assert.deepStrictEqual(json, {
            name: "Example",
            columns: [
                {
                    name: "To do",
                    id: "MDEzOlByb2plY3RDb2x1bW4xMjE5NTUzMA==",
                    items: [
                        {
                            __typename: "ProjectCard",

                            body: "- [ ] Details Note A\n- [link](https://example.com)",
                            id: "PRC_lALOE04f3s4AmnKAzgQ6c4c",
                            labels: [],
                            state: "OPEN",
                            title: "Note A",
                            url: "https://github.com/azu/github-project-todo-md/projects/1#card-70939527"
                        },
                        {
                            __typename: "Issue",
                            id: "MDU6SXNzdWU3NzM3MjczODE=",
                            title: "TODO ISSUE",
                            url: "https://github.com/azu/github-project-todo-md/issues/4",
                            body: "FOR TESTING",
                            labels: {
                                nodes: [
                                    {
                                        name: "Type: Testing",
                                        description: "Adding missing tests or correcting existing tests"
                                    }
                                ]
                            },
                            state: "OPEN"
                        }
                    ]
                },
                {
                    name: "In progress",
                    id: "MDEzOlByb2plY3RDb2x1bW4xMjE5NTUzMQ==",
                    items: [
                        {
                            __typename: "Issue",
                            id: "MDU6SXNzdWU3NzM3MjY5OTA=",
                            title: "PROGRESS ISSUE",
                            url: "https://github.com/azu/github-project-todo-md/issues/3",
                            body: "",
                            labels: {
                                nodes: [
                                    {
                                        name: "Type: Testing",
                                        description: "Adding missing tests or correcting existing tests"
                                    }
                                ]
                            },
                            state: "OPEN"
                        }
                    ]
                },
                {
                    name: "Done",
                    id: "MDEzOlByb2plY3RDb2x1bW4xMjE5NTUzMg==",
                    items: [
                        {
                            __typename: "Issue",
                            id: "MDU6SXNzdWU3NzM3Mjc5MTA=",
                            title: "DONE ISSUE",
                            url: "https://github.com/azu/github-project-todo-md/issues/5",
                            body: "FOR TESTING",
                            labels: {
                                nodes: [
                                    {
                                        name: "Type: Testing",
                                        description: "Adding missing tests or correcting existing tests"
                                    }
                                ]
                            },
                            state: "CLOSED"
                        }
                    ]
                }
            ]
        });
        assert.strictEqual(
            markdown,
            `## To do

- [ ] [Note A](https://github.com/azu/github-project-todo-md/projects/1#card-70939527)
    - [ ] TODO Note A
    - [link](https://example.com)
- [ ] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)

## In progress

- [ ] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)

## Done

- [x] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`
        );
    });
});
