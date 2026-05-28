import { createOpenAIToolSet, createAnthropicToolSet } from "../dist/index.js";

const openai = await createOpenAIToolSet({ projectRoot: "." });
console.log("OpenAI tools:");
console.log(JSON.stringify(openai.tools, null, 2));
console.log(await openai.execute("echo_echo", { message: "hello openai adapter" }));

const anthropic = await createAnthropicToolSet({ projectRoot: "." });
console.log("Anthropic tools:");
console.log(JSON.stringify(anthropic.tools, null, 2));
console.log(await anthropic.execute("echo_echo", { message: "hello anthropic adapter" }));
