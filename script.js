document.addEventListener('DOMContentLoaded', function () {
  // Header animation
  const headerEl = document.querySelector('header');
  const shopHeaderEl = document.querySelector('.shop-header');

  if (headerEl) {
    headerEl.classList.remove('header-start-hidden');
    headerEl.classList.add('animate-fadeDown');
  }
  if (shopHeaderEl) {
    shopHeaderEl.classList.remove('shopheader-start-hidden');
    shopHeaderEl.classList.add('animate-fadeIn');
  }

  // Staggered product reveal
  const cards = document.querySelectorAll('.product-card');
  cards.forEach((card, i) => {
    card.classList.add('product-start-hidden');
    setTimeout(() => {
      card.classList.remove('product-start-hidden');
      card.classList.add('animate-zoomIn');
    }, 180 + i * 120);
  });
});


// Product filtering
const filterButtons = document.querySelectorAll(".filter-btn");
const products = document.querySelectorAll(".product-card");

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    // Remove active class from all buttons
    filterButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    const filterValue = button.getAttribute("data-filter");

    products.forEach(product => {
      if (filterValue === "all" || product.getAttribute("data-category") === filterValue) {
        product.style.display = "block";
      } else {
        product.style.display = "none";
      }
    });
  });
});

// Check if URL has a category in the hash
const initialCategory = window.location.hash.replace('#', '');
if (initialCategory) {
  const initialButton = document.querySelector(`.filter-btn[data-filter="${initialCategory}"]`);
  if (initialButton) {
    initialButton.click();
  }
}


// WhatsApp order button logic
document.querySelectorAll('.btn-buy').forEach(button => {
  button.addEventListener('click', function (event) {
    event.preventDefault();

    const productCard = this.closest('.product-card');
    const name = productCard.querySelector('h4').innerText;
    const price = productCard.querySelector('.price').innerText;
    const imgSrc = productCard.querySelector('img').src;

    // Your Kenya WhatsApp number
    const phoneNumber = "254728939472"; // <-- replace with your number

    // Formatted Kenya-only message
   const message =
   `${imgSrc}\n\n` +
    "🌸 Luxe by Dotty 🌸\n" +
    "━━━━━━━━━━━━━━━\n" +
    "📦 Product: " + name + "\n" +
    "💰 Price: " + price + "\n" +
    "🖼 Photo: " + imgSrc + "\n" +
    "━━━━━━━━━━━━━━━\n" +
    "🚚 Delivery: All over Kenya Only\n\n" +
    "Hi, I’d like to place an order for this item. Please confirm availability.";


    // Create WhatsApp link
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    // Open WhatsApp with prefilled message
    window.open(url, '_blank');
  });
});
