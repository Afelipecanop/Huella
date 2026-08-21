import PostalMime from "postal-mime";

export type ParsedEmail = {
  from: string;
  text: string;
};

export async function parseEmail(raw: ReadableStream<Uint8Array>): Promise<ParsedEmail> {
  const buffer = await new Response(raw).arrayBuffer();
  const parsed = await new PostalMime().parse(buffer);

  const text = parsed.text?.trim() ? parsed.text : stripHtml(parsed.html ?? "");

  return {
    from: parsed.from?.address ?? "",
    text,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
