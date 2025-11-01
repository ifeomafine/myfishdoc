document.addEventListener("DOMContentLoaded", async () => {
  const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/nx13ilko39doy4w6cdo4e9mch2irl8uf";

  const signupModal = document.getElementById("signupModal");
  const appContainer = document.getElementById("appContainer");
  const footer = document.getElementById("appFooter");

  const emailInput = document.getElementById("userEmail");
  const refInput = document.getElementById("referralCode");
  const continueBtn = document.getElementById("continueBtn");

  const urlParams = new URLSearchParams(window.location.search);
  const refFromLink = urlParams.get("ref");

  let userData = JSON.parse(localStorage.getItem("userData")) || null;

  // Show main app if user is already logged in
  if (userData) {
    signupModal.classList.remove("active");
    signupModal.classList.add("hidden");
    appContainer.classList.remove("hidden");
    footer.classList.remove("hidden");
  }

  // Generate random user ID
  function generateUserId() {
    return "user_" + Math.random().toString(36).substring(2, 9);
  }

  // Send data to Make webhook
  async function sendToWebhook(payload) {
    try {
      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Webhook Error:", err);
    }
  }

  // Signup handler
  continueBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const referral = refInput.value.trim() || refFromLink || null;

    if (!email) {
      alert("Please enter your email to continue.");
      return;
    }

    userData = {
      userId: generateUserId(),
      email,
      isPro: false,
      diagnosisCount: 0,
      referralCount: 0,
      referredBy: referral,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("userData", JSON.stringify(userData));

    // Hide modal and show app
    signupModal.classList.add("hidden");
    appContainer.classList.remove("hidden");
    footer.classList.remove("hidden");

    // Send signup to Make
    await sendToWebhook({
      event: "signup",
      userId: userData.userId,
      email: userData.email,
      referredBy: userData.referredBy,
      date: new Date().toISOString(),
    });

    // Trigger referral credit if applicable
    if (referral) {
      await sendToWebhook({
        event: "referral_used",
        referredBy: referral,
        newUser: userData.email,
        newUserId: userData.userId,
        date: new Date().toISOString(),
      });
    }

    alert("Welcome to MyFishDoc Online!");
  });

  // ---- The rest of your existing logic (tabs, records, diagnosis, etc.) ----
});
