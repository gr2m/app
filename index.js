// @ts-check

import { createServer, ServerResponse } from "node:http";

import { Octokit } from "@octokit/core";
import { verify } from "@copilot-extensions/preview-sdk";

// Create a local server to receive data from
const server = createServer(async (request, response) => {
  console.log(request.method, request.url, {
    ...request.headers,
    "x-github-token": "REDACTED",
  });

  if (request.method === "GET") {
    response.statusCode = 200;
    response.end(`Hello, there!`);
    return;
  }

  const body = await getBody(request);
  const signature = String(request.headers["github-public-key-signature"]);
  const keyID = String(request.headers["github-public-key-identifier"]);
  const tokenForUser = String(request.headers["x-github-token"]);

  try {
    const isValidRequest = await verify(body, signature, keyID, {
      token: tokenForUser,
    });

    if (!isValidRequest) {
      response.statusCode = 401;
      response.end(`Signature verification failed`);
      return;
    }
  } catch (error) {
    console.error("Error while verifying request", error);
    response.statusCode = 500;
    response.end(`FATAL: error while verifying request`);
    return;
  }

  const octokit = new Octokit({ auth: tokenForUser });
  const { data: user } = await octokit.request("GET /user");

  sayHi(response, user.login);
});

server.listen(3000);
console.log("listening at http://localhost:3000");

function getBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request
      .on("data", (chunk) => {
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts).toString();
        resolve(body);
      });
  });
}

/**
 *
 * @param {ServerResponse} response
 */
function sayHi(response, login) {
  const lines = [
    {
      choices: [
        {
          delta: { content: `Hi there, @${login}!?`, role: "assistant" },
        },
      ],
    },
    {
      choices: [
        {
          finish_reason: "stop",
          delta: { content: null },
        },
      ],
    },
  ];

  for (const line of lines) {
    response.write(`data: ${JSON.stringify(line)}\n\n`);
  }

  response.write("data: [DONE]\n\n");
  response.end();
}
