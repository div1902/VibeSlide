import { prepareDesignEditor } from "@canva/intents/design";
import { createRoot } from "react-dom/client";
import App from "./App";
import styles from "./styles.css?inline";

prepareDesignEditor({
  async render() {
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);
    let container = document.getElementById("root");
    if (!container) {
      container = document.createElement("div");
      container.id = "root";
      document.body.append(container);
    }
    createRoot(container).render(<App />);
  },
});
