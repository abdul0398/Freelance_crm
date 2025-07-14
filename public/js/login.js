document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const errorMessage = document.getElementById("errorMessage");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  // Handle form submission
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError("Please fill in all fields");
      return;
    }

    // Show loading state
    loginBtn.classList.add("loading");
    hideError();

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Login successful
        window.location.href = "/";
      } else {
        // Login failed
        showError(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      showError("An error occurred. Please try again.");
    } finally {
      // Hide loading state
      loginBtn.classList.remove("loading");
    }
  });

  // Error handling
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add("show");
  }

  function hideError() {
    errorMessage.classList.remove("show");
  }

  // Demo credentials functionality
  const demoInfo = document.querySelector(".demo-info");
  if (demoInfo) {
    demoInfo.addEventListener("click", function (e) {
      if (e.target.textContent.includes("admin / admin123")) {
        usernameInput.value = "admin@freelancecrm.com";
        passwordInput.value = "admin123";
      } else if (e.target.textContent.includes("user / user123")) {
        usernameInput.value = "john@example.com";
        passwordInput.value = "user123";
      }
    });
  }
});

// Password toggle functionality
function togglePassword() {
  const passwordInput = document.getElementById("password");
  const eyeIcon = document.getElementById("eyeIcon");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94L17.94 17.94z"/>
      <path d="M1 1l22 22"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19L9.9 4.24z"/>
    `;
  } else {
    passwordInput.type = "password";
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
}
