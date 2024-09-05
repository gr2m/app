# Dreamcode for this app

The next step would be the use of a higher-level SDK which does not exist yet, and it's unclear when I get to work on it. The spec is being discussed at https://github.com/copilot-extensions/preview-sdk.js/blob/main/dreamcode.md

For this particular app, I'd like to implement all the functionality as different functions and then use function calling to invoke them.

The code would look like this:

```js
import { createServer } from "node:http";

import { CopilotAgent, createNodeMiddleware } from "@octokit/copilot-extension";

const copilotAgent = new CopilotAgent({
  userAgent: "gr2m-copilot-agent",
  system:
    "You are a Copilot agent made to test and showcase the capabilities of Copilot Extensions. Users will ask you to showcase functionalities that are defined as tools in your configuration. If you cannot match the user's request to a tool, you should respond with the list of functions that you support.",

  functions: [
    {
      name: "star_repository",
      description: "Star the current repository",
      parameters: {
        owner: {
          type: "string",
          description: "The repository's owner login.",
        },
        repo: {
          type: "string",
          description: "The repository name",
        },
      },
      confirmation: {
        title: "Are you sure?",
        message(parameters) {
          return `Yes, please book star repository ${parameters.owner}/${parameters.repo}`;
        },
      },
      async run({ octokit, respond, parameters: { owner, repo } }) {
        await octokit.request("PUT /user/starred/{owner}/{repo}", {
          owner,
          repo,
        });

        respond.text("Repository has been starred");
      },
    },
    {
      name: "is_repository_starred",
      description: "Check if the current repository is starred",
      parameters: {
        owner: {
          type: "string",
          description: "The repository's owner login.",
        },
        repo: {
          type: "string",
          description: "The repository name",
        },
      },
      async run({ octokit, respond, parameters: { owner, repo } }) {
        try {
          await octokit.request("GET /user/starred/{owner}/{repo}", {
            owner,
            repo,
          });
        } catch (error) {
          if (error.status !== 404) throw error;

          respond.text("Repository is not starred");
        }
      },
    },
    {
      name: "trigger_confirmation",
      description: "Trigger a confirmation dialog",
      async run({ respond }) {
        await respond.confirm({
          id: "my-confirmation",
          title: "Are you sure?",
          message: "Please confirm",
        });
      },
    },
    {
      name: "trigger_reference",
      description: "Trigger an assistant response that includes references",
      async run({ respond }) {
        await respond.references([
          {
            type: "blackbeard.story",
            id: "snippet",
            data: {
              file: "story.go",
              start: "0",
              end: "13",
              content: "func main()...writeStory()...",
            },
            is_implicit: false,
            metadata: {
              display_name: "Lines 1-13 from story.go",
              display_icon: "icon",
              display_url: "http://blackbeard.com/story/1",
            },
          },
        ]);
      },
    },
    {
      name: "trigger_error",
      description: "Trigger an assistant response that includes errors",
      async run({ respond }) {
        const referenceError = {
          type: "reference",
          code: "1",
          message: "test reference error",
          identifier: "reference-identifier",
        };
        const functionError = {
          type: "function",
          code: "1",
          message: "test function error",
          identifier: "function-identifier",
        };
        const agentError = {
          type: "agent",
          code: "1",
          message: "test agent error",
          identifier: "agent-identifier",
        };
        response.write(
          createErrorsEvent([referenceError, functionError, agentError]),
        );
      },
    },
  ],
});

createServer(createNodeMiddleware(copilotAgent)).listen(3000);
copilotAgent.log.info("Listening on http://localhost:3000");
```
