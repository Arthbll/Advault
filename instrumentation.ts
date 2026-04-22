export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason, promise) => {
      if (reason instanceof SyntaxError && reason.message.includes("JSON")) {
        console.error("=== JSON PARSE ERROR TRACE ===");
        console.error(reason.stack);
        console.error("Promise:", promise);
        console.error("==============================");
      }
    });
  }
}
