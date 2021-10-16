import { createSyncRequestObject, syncToProject } from "../src/markdown-to-project";
import assert from "assert";

const TOKEN = process.env.GITHUB_TOKEN as string;
if (!TOKEN) {
    throw new Error("should set GITHUB_TOKEN before testing");
}

describe("project-to-markdown", function () {
    it("should get request object", async () => {
        const CODE = `## To do

- [ ] [Note A](https://github.com/azu/github-project-todo-md/projects/1#card-70939527)
    - Details Note A
    - [link](https://example.com)
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
            token: TOKEN,
            includesNote: true
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
    it("should sync with linked note", async () => {
        const CODE = `## To do

- [ ] [Note A](https://github.com/azu/github-project-todo-md/projects/1#card-70939527)
    - Details Note A
    - [link](https://example.com)
- [ ] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)


## In progress

- [ ] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)


## Done

- [x] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`;
        await syncToProject(CODE, {
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN,
            includesNote: true
        });
    });
    it("should sync without linked note", async () => {
        const CODE = `## To do

- [x] Note cccc
    - testa
    - asa
    asdsa
- [ ] Note A
    - Details Note A
    - [link](https://example.com)
- [ ] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)


## In progress

- [ ] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)


## Done

- [x] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`;
        await syncToProject(CODE, {
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN,
            includesNote: true
        });
    });
});
