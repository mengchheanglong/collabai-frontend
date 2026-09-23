/** Small Markdown subset. Escape source first; raw HTML and links cannot execute. */
export function renderMarkdown(source: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const inline = (s: string) =>
    escape(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  let code = false;
  let list = false;
  const out: string[] = [];
  for (const line of source.split("\n")) {
    if (line.startsWith("```")) {
      if (list) {
        out.push("</ul>");
        list = false;
      }
      out.push(code ? "</code></pre>" : "<pre><code>");
      code = !code;
      continue;
    }
    if (code) {
      out.push(escape(line) + "\n");
      continue;
    }
    const item = /^[-*] (.*)$/.exec(line);
    if (item) {
      if (!list) out.push("<ul>");
      list = true;
      out.push("<li>" + inline(item[1]) + "</li>");
      continue;
    }
    if (list) {
      out.push("</ul>");
      list = false;
    }
    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading)
      out.push(
        "<h" +
          heading[1].length +
          ">" +
          inline(heading[2]) +
          "</h" +
          heading[1].length +
          ">",
      );
    else if (line.startsWith("> "))
      out.push("<blockquote>" + inline(line.slice(2)) + "</blockquote>");
    else out.push(line ? "<p>" + inline(line) + "</p>" : "<br>");
  }
  if (code) out.push("</code></pre>");
  if (list) out.push("</ul>");
  return out.join("");
}
