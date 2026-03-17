export async function callNim(
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number
): Promise<string> {
  const baseUrl = process.env.NIM_BASE_URL;
  const apiKey = process.env.NIM_API_KEY;
  const model = process.env.NIM_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("Missing NIM_BASE_URL, NIM_API_KEY, or NIM_MODEL");
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      // Disable extended reasoning to prevent the model from exhausting
      // max_tokens on chain-of-thought before producing the actual JSON answer.
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NIM ${res.status}: ${text}`);
  }

  const json = await res.json();
  const msg = json?.choices?.[0]?.message;
  // Reasoning models may put the answer in `content` and thinking in `reasoning_content`.
  // If `content` is null (model ran out of tokens during reasoning), fall back to reasoning_content.
  const content: string = msg?.content ?? msg?.reasoning_content ?? "";
  return content;
}
