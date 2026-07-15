export async function generateMarketingContent(prompt: string) {
  try {
    const res = await fetch("/api/ai/marketing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return data.text;
  } catch (error) {
    console.error("AI Generation Error (via backend):", error);
    return "Sorry, I couldn't generate content right now. Please try again later.";
  }
}

export async function suggestLayout(eventType: string) {
  try {
    const res = await fetch("/api/ai/layout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ eventType })
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return data.layout;
  } catch (error) {
    console.error("AI Layout Suggestion Error (via backend):", error);
    return { photosCount: 4, textOverlays: ["Event Name", "Date"] };
  }
}
