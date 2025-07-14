// Admin Panel JavaScript
let currentUsers = [];
let editingUserId = null;

// Initialize admin panel
document.addEventListener("DOMContentLoaded", function () {
  loadUsers();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // User form submission
  document
    .getElementById("userForm")
    .addEventListener("submit", handleUserSubmit);

  // Modal close on outside click
  document.getElementById("userModal").addEventListener("click", function (e) {
    if (e.target === this) {
      closeUserModal();
    }
  });

  // Escape key to close modal
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      document.getElementById("userModal").classList.contains("show")
    ) {
      closeUserModal();
    }
  });
}

// Load users from API
async function loadUsers() {
  try {
    showLoading();
    const response = await fetch("/api/admin/users");

    if (!response.ok) {
      throw new Error("Failed to load users");
    }

    currentUsers = await response.json();
    renderUsersTable();
  } catch (error) {
    console.error("Error loading users:", error);
    showAlert("Failed to load users", "error");
  } finally {
    hideLoading();
  }
}

// Render users table
function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");

  if (currentUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h3>No users found</h3>
            <p>Get started by creating your first user</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentUsers
    .map(
      (user) => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="user-avatar">
            ${user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="font-medium">${escapeHtml(user.name)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.email)}</td>
      <td>
        <span class="role-badge role-${user.role}">${user.role}</span>
      </td>
      <td>
        <span class="status-badge status-${
          user.is_active ? "active" : "inactive"
        }">
          ${user.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <div class="text-sm text-gray-600">
          ${new Date(user.created_at).toLocaleDateString()}
        </div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn action-btn-edit" onclick="editUser(${
            user.id
          })">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="action-btn action-btn-reset" onclick="resetPassword(${
            user.id
          })">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Reset
          </button>
          ${
            user.role !== "admin"
              ? `
          <button class="action-btn action-btn-delete" onclick="deleteUser(${
            user.id
          }, '${escapeHtml(user.name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete
          </button>
          `
              : ""
          }
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

// Open user modal
function openUserModal(userId = null) {
  const modal = document.getElementById("userModal");
  const modalTitle = document.getElementById("modalTitle");
  const form = document.getElementById("userForm");

  editingUserId = userId;

  if (userId) {
    // Edit mode
    const user = currentUsers.find((u) => u.id === userId);
    if (user) {
      modalTitle.textContent = "Edit User";
      document.getElementById("userName").value = user.name;
      document.getElementById("userEmail").value = user.email;
      // Hide password field for editing
      const passwordGroup = document
        .getElementById("userPassword")
        .closest(".form-group");
      passwordGroup.style.display = "none";
      document.getElementById("userPassword").removeAttribute("required");
    }
  } else {
    // Add mode
    modalTitle.textContent = "Add User";
    form.reset();

    // Show password field for new user
    const passwordGroup = document
      .getElementById("userPassword")
      .closest(".form-group");
    passwordGroup.style.display = "block";
    document
      .getElementById("userPassword")
      .setAttribute("required", "required");
  }

  modal.classList.add("show");
  document.getElementById("userName").focus();
}

// Close user modal
function closeUserModal() {
  const modal = document.getElementById("userModal");
  modal.classList.remove("show");
  editingUserId = null;
  document.getElementById("userForm").reset();
}

// Handle user form submission
async function handleUserSubmit(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById("userName").value.trim(),
    email: document.getElementById("userEmail").value.trim(),
    role: "user",
  };

  // Add password for new users
  if (!editingUserId) {
    formData.password = document.getElementById("userPassword").value;
  }

  try {
    showLoading();

    const url = editingUserId
      ? `/api/admin/users/${editingUserId}`
      : "/api/admin/users";

    const method = editingUserId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save user");
    }

    const result = await response.json();

    showAlert(
      editingUserId ? "User updated successfully" : "User created successfully",
      "success"
    );

    closeUserModal();
    loadUsers();
  } catch (error) {
    console.error("Error saving user:", error);
    showAlert(error.message, "error");
  } finally {
    hideLoading();
  }
}

// Edit user
function editUser(userId) {
  openUserModal(userId);
}

// Reset user password
async function resetPassword(userId) {
  const user = currentUsers.find((u) => u.id === userId);
  if (!user) return;

  const newPassword = prompt(`Enter new password for ${user.name}:`);
  if (!newPassword) return;

  if (newPassword.length < 6) {
    showAlert("Password must be at least 6 characters long", "error");
    return;
  }

  try {
    showLoading();

    const response = await fetch(`/api/admin/users/${userId}/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reset password");
    }

    showAlert("Password reset successfully", "success");
  } catch (error) {
    console.error("Error resetting password:", error);
    showAlert(error.message, "error");
  } finally {
    hideLoading();
  }
}

// Delete user
async function deleteUser(userId, userName) {
  if (
    !confirm(
      `Are you sure you want to delete user "${userName}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    showLoading();

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete user");
    }

    showAlert("User deleted successfully", "success");
    loadUsers();
  } catch (error) {
    console.error("Error deleting user:", error);
    showAlert(error.message, "error");
  } finally {
    hideLoading();
  }
}

// Utility functions
function showAlert(message, type = "info") {
  // Remove existing alerts
  const existingAlerts = document.querySelectorAll(".alert");
  existingAlerts.forEach((alert) => alert.remove());

  // Create new alert
  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  // Insert at the top of admin content
  const adminContent = document.querySelector(".admin-content");
  adminContent.insertBefore(alert, adminContent.firstChild);

  // Auto remove after 5 seconds
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

function showLoading() {
  document.body.classList.add("loading");
}

function hideLoading() {
  document.body.classList.remove("loading");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// User avatar style
const userAvatarStyle = `
  .user-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
  }
`;

// Inject user avatar styles
const style = document.createElement("style");
style.textContent = userAvatarStyle;
document.head.appendChild(style);
