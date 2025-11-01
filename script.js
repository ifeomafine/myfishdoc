// ====== SIGNUP & REFERRAL LOGIC ======
document.addEventListener("DOMContentLoaded", () => {
  const continueBtn = document.getElementById("continueBtn");
  const emailInput = document.getElementById("userEmail");
  const referralInput = document.getElementById("referralCode");
  const signupModal = document.getElementById("signupModal");
  const appContainer = document.getElementById("appContainer");
  const footer = document.getElementById("appFooter");

  const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/nx13ilko39doy4w6cdo4e9mch2irl8uf";

  // Auto-fill referral code from ?ref= param
  const urlParams = new URLSearchParams(window.location.search);
  const refFromLink = urlParams.get("ref");
  if (refFromLink) referralInput.value = refFromLink;

  // Check if user already signed up (stored locally)
  const savedUser = JSON.parse(localStorage.getItem("myfishdoc_user"));
  if (savedUser) {
    signupModal.classList.add("hidden");
    appContainer.classList.remove("hidden");
    footer.classList.remove("hidden");
  }

  function generateUserId() {
    return "user_" + Math.random().toString(36).substring(2, 9);
  }

  // Handle Continue button
  continueBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const referralCode = referralInput.value.trim();

    if (!email) {
      alert("Please enter your email.");
      return;
    }

    const userData = {
      userId: generateUserId(),
      email,
      referredBy: referralCode || refFromLink || null,
      referralCount: 0,
      isPro: false,
      diagnosisCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Save locally
    localStorage.setItem("myfishdoc_user", JSON.stringify(userData));

    // Send signup data to Make
    try {
      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "signup",
          ...userData,
        }),
      });

      if (userData.referredBy) {
        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "referral_used",
            referrer: userData.referredBy,
            newUser: userData.email,
          }),
        });
      }
    } catch (err) {
      console.error("Webhook error:", err);
    }

    // Hide modal, show app
    signupModal.classList.add("hidden");
    appContainer.classList.remove("hidden");
    footer.classList.remove("hidden");

    alert("Welcome to MyFishDoc! Your account has been created.");
  });

  // ====== TAB SWITCHING ======
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(tab => tab.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });

  // ====== REFERRAL SHARING ======
  function handleReferral() {
    const user = JSON.parse(localStorage.getItem("myfishdoc_user"));
    if (!user) {
      alert("Please sign up first.");
      return;
    }
    const referralLink = `${window.location.origin}?ref=${user.userId}`;
    navigator.clipboard.writeText(referralLink);
    alert(`Referral link copied!\n\n${referralLink}\n\nShare this with friends.`);
  }

  // ====== FARM RECORDS ======
  const form = document.getElementById("recordForm");
  const tableBody = document.querySelector("#recordsTable tbody");
  let records = JSON.parse(localStorage.getItem("farmRecords")) || [];

  function renderRecords() {
    tableBody.innerHTML = "";
    let totalFish = 0,
      totalFeed = 0,
      totalExpense = 0;

    records.forEach((r, i) => {
      totalFish += parseInt(r.fishCount) || 0;
      totalFeed += parseFloat(r.feedUsed) || 0;
      totalExpense += parseFloat(r.expense) || 0;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${r.date}</td>
        <td>${r.pondName}</td>
        <td>${r.fishCount}</td>
        <td>${r.feedUsed}</td>
        <td>${r.expense}</td>
        <td>${r.notes}</td>
        <td class="actions">
          <button class="action-btn edit" data-index="${i}">✏️</button>
          <button class="action-btn delete" data-index="${i}">🗑️</button>
        </td>`;
      tableBody.appendChild(row);
    });

    document.getElementById("totalFish").textContent = totalFish;
    document.getElementById("totalFeed").textContent = totalFeed.toFixed(1);
    document.getElementById("totalExpense").textContent = totalExpense.toLocaleString();

    localStorage.setItem("farmRecords", JSON.stringify(records));
  }

  form?.addEventListener("submit", e => {
    e.preventDefault();
    const newRecord = {
      date: form.date.value || new Date().toISOString().split("T")[0],
      pondName: form.pondName.value,
      fishCount: form.fishCount.value,
      feedUsed: form.feedUsed.value,
      expense: form.expense.value,
      notes: form.notes.value,
    };
    records.push(newRecord);
    renderRecords();
    form.reset();
  });

  tableBody?.addEventListener("click", e => {
    if (e.target.classList.contains("delete")) {
      records.splice(e.target.dataset.index, 1);
      renderRecords();
    }
    if (e.target.classList.contains("edit")) {
      const r = records[e.target.dataset.index];
      form.date.value = r.date;
      form.pondName.value = r.pondName;
      form.fishCount.value = r.fishCount;
      form.feedUsed.value = r.feedUsed;
      form.expense.value = r.expense;
      form.notes.value = r.notes;
      records.splice(e.target.dataset.index, 1);
      renderRecords();
    }
  });

  renderRecords();

  // ====== AI DISEASE DIAGNOSIS ======
  const diagnoseBtn = document.getElementById("diagnoseBtn");
  diagnoseBtn?.addEventListener("click", async () => {
    const input = document.getElementById("diseaseInput").value.trim();
    const resultDiv = document.getElementById("diagnosisResult");
    const user = JSON.parse(localStorage.getItem("myfishdoc_user"));

    if (!input) {
      alert("Please describe the fish symptoms.");
      return;
    }

    if (!user.isPro && (user.diagnosisCount || 0) >= 2) {
      resultDiv.innerHTML = `
        <p style="color:red;">Free limit reached (2 per week).<br>
        Invite 3 users to unlock unlimited access.</p>
        <button id="referBtn" class="refer-btn">Refer Friends</button>`;
      return;
    }

    resultDiv.innerHTML = "<p>Analyzing symptoms...</p>";

    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `You are an aquaculture expert. Based on this description: "${input}", identify the likely fish disease, recommend treatment, and prevention steps. Format strictly as JSON with keys: diagnosis, treatment, prevention.`,
            },
          ],
        }),
      });

      const data = await response.json();
      let text = data.content?.[0]?.text || "";
      text = text.replace(/```json|```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {
          diagnosis: "Could not extract structured diagnosis.",
          treatment: text,
          prevention: "Try rephrasing your input.",
        };
      }

      resultDiv.innerHTML = `
        <div class="ai-card"><h3>Diagnosis</h3><p>${parsed.diagnosis}</p></div>
        <div class="ai-card"><h3>Treatment</h3><p>${parsed.treatment}</p></div>
        <div class="ai-card"><h3>Prevention</h3><p>${parsed.prevention}</p></div>
      `;

      user.diagnosisCount = (user.diagnosisCount || 0) + 1;
      localStorage.setItem("myfishdoc_user", JSON.stringify(user));
    } catch (err) {
      console.error("Claude API Error:", err);
      resultDiv.innerHTML = `<p style="color:red;">Error connecting to AI diagnosis.</p>`;
    }
  });

  document.addEventListener("click", e => {
    if (e.target.id === "referBtn") handleReferral();
  });
});
