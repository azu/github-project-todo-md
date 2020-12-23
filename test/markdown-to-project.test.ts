import { createSyncRequestObject, syncToProject } from "../src/markdown-to-project";
import assert from "assert";

const TOKEN = process.env.GITHUB_TOKEN as string;

const CODE = `## To do

- [ ] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)


## In progress

- [ ] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)


## Done

- [x] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`;
describe("project-to-markdown", function () {
    it("should get request object", async () => {
        const CODE = `## To do

- [x] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)


## In progress

- [x] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)


## Done

- [x] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`;
        const request = await createSyncRequestObject(CODE, {
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN
        });
        assert.deepStrictEqual(request, [
            {
                __typename: "Issue",
                id: "MDU6SXNzdWU3NzM3MjczODE=",
                state: "CLOSED"
            },
            { __typename: "Issue", id: "MDU6SXNzdWU3NzM3MjY5OTA=", state: "CLOSED" }
        ]);
    });
    it("should sync", async () => {
        await syncToProject(CODE, {
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN
        });
    });
});
