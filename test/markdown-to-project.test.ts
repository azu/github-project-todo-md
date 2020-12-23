import { syncToProject } from "../src/markdown-to-project";

const TOKEN = process.env.GITHUB_TOKEN as string;

describe("project-to-markdown", function () {
    it("should sync", async () => {
        const CODE = `## To do

- [ ] [TODO ISSUE](https://github.com/azu/github-project-todo-md/issues/4)


## In progress

- [ ] [PROGRESS ISSUE](https://github.com/azu/github-project-todo-md/issues/3)


## Done

- [ ] [DONE ISSUE](https://github.com/azu/github-project-todo-md/issues/5)
`;
        await syncToProject(CODE, {
            owner: "azu",
            repo: "github-project-todo-md",
            projectNumber: 1,
            token: TOKEN
        });
    });
});
