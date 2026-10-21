// A fake "model" so you can see the page without any API key. It always uses the same example family.
// It is not a real AI, the page shows a banner when it is on.
export function demoProvider() {
  return {
    name: "demo",
    async chat({ messages }) {
      const last = messages.at(-1);
      if (last.role === "user") {
        const estate = Number((last.content.match(/\d[\d\s,.]{2,}/) || ["120000"])[0].replace(/\D/g, "")) || 120000;
        return {
          text: "",
          toolCalls: [{
            id: "demo1",
            name: "calculate_inheritance",
            input: {
              deceased_gender: "male",
              heirs: [{ relationship: "WIFE" }, { relationship: "SON", count: 2 }, { relationship: "DAUGHTER" }, { relationship: "MOTHER" }],
              total_estate_value: estate,
            },
          }],
        };
      }
      const data = JSON.parse(last.results[0].content);
      const lines = data.heirs.map((h) => `- ${h.heir}: ${h.share}${h.amount != null ? ` (${h.amount})` : ""}`);
      return {
        text: "**وضع تجريبي** (ليس ذكاءً اصطناعياً حقيقياً). هذا مثال ثابت للعائلة: زوجة وابنان وبنت وأم.\n\n" + lines.join("\n"),
        toolCalls: [],
      };
    },
  };
}
