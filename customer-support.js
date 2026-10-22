document.addEventListener("DOMContentLoaded", () => {
  const phoneNumber = "254728939472";
  const panel = document.createElement("section");
  panel.className = "support-chat-panel";
  panel.id = "support-chat-panel";
  panel.setAttribute("aria-label", "Dotty Elegance customer service");
  panel.hidden = true;

  const heading = document.createElement("div");
  heading.className = "support-chat-heading";
  const title = document.createElement("h2");
  title.textContent = "Customer service";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "support-chat-close";
  closeButton.setAttribute("aria-label", "Close customer service chat");
  closeButton.textContent = "×";
  heading.append(title, closeButton);

  const messages = document.createElement("div");
  messages.className = "support-chat-messages";
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions text");
  const choices = document.createElement("div");
  choices.className = "support-chat-choices";
  choices.setAttribute("aria-label", "Common questions");
  panel.append(heading, messages, choices);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "support-chat-launcher";
  launcher.setAttribute("aria-controls", panel.id);
  launcher.setAttribute("aria-expanded", "false");
  launcher.textContent = "Customer help";

  function appendMessage(text, type = "assistant") {
    const message = document.createElement("p");
    message.className = `support-chat-message support-chat-message-${type}`;
    message.textContent = text;
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function openWhatsApp() {
    const message = "Hello Dotty Elegance, I have a question about your products or an order.";
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const answers = [
    {
      label: "Products & prices",
      answer: "Browse the current wigs and weaves in our shop. Prices are shown on each product card; please message us to confirm availability before ordering.",
      link: { label: "Browse the shop", href: "shop.html" }
    },
    {
      label: "Colors & lengths",
      answer: "Our shop notes lengths from 6 to 30 inches, and many styles come in different colors. Options depend on the style and current stock, so ask us to confirm what is available.",
      link: { label: "Ask us on WhatsApp", action: openWhatsApp }
    },
    {
      label: "Delivery",
      answer: "The home page advertises free delivery when you buy 3 or more items. Please confirm eligible items, delivery areas, and timing with the store before ordering.",
      link: { label: "Ask about delivery", action: openWhatsApp }
    },
    {
      label: "Orders & tracking",
      answer: "Website orders appear in My Account after you create an account. The store updates tracking statuses manually; automatic tracking texts or emails are not available yet.",
      link: { label: "Open My Account", href: "account.html" }
    },
    {
      label: "Favorites & accounts",
      answer: "Create a customer account to save favorites and view your order history. If you need help, contact us.",
      link: { label: "Open My Account", href: "account.html" }
    },
    {
      label: "Payments & safety",
      answer: "This website does not take online payments. Never enter or send payment-card numbers, PINs, passwords, or one-time codes in this chat. Confirm payment instructions directly with the store.",
      link: { label: "Contact the store", action: openWhatsApp }
    }
  ];

  function addChoice(label, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-chat-choice";
    button.textContent = label;
    button.addEventListener("click", callback);
    choices.append(button);
  }

  function showMenu() {
    choices.replaceChildren();
    answers.forEach((item) => {
      addChoice(item.label, () => {
        appendMessage(item.label, "customer");
        appendMessage(item.answer);
        if (item.link) {
          const link = document.createElement("a");
          link.className = "support-chat-link";
          link.textContent = item.link.label;
          if (item.link.href) {
            link.href = item.link.href;
          } else {
            link.href = "#contact-support";
            link.addEventListener("click", (event) => {
              event.preventDefault();
              item.link.action();
            });
          }
          messages.append(link);
        }
        addChoice("Back to questions", showMenu);
      });
    });
    addChoice("Talk to a person on WhatsApp", openWhatsApp);
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (!messages.childElementCount) {
      appendMessage("Hello! I'm Dotty Elegance's customer-service assistant. Choose a topic below or contact our team on WhatsApp.");
      showMenu();
    }
    closeButton.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });
  closeButton.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });

  document.body.append(panel, launcher);
});
