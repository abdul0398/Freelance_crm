// App State
const API_BASE = "/api";

// App State
let leads = [];
let filteredLeads = [];
let users = [];
let editingLeadId = null;
let currentUser = window.currentUser; // Use the current user from window

// Pipeline stages configuration
const stages = [
  { id: "cold", title: "Cold Outreach", color: "#6b7280" },
  { id: "contacted", title: "Contacted", color: "#3b82f6" },
  { id: "warm", title: "Warm Lead", color: "#f59e0b" },
  { id: "negotiating", title: "Negotiating", color: "#8b5cf6" },
  { id: "won", title: "Won", color: "#10b981" },
  { id: "lost", title: "Lost", color: "#ef4444" },
];

// Initialize app
async function init() {
  await fetchUsers();
  await fetchLeads();
  renderPipeline();
  updateStats();
  setupEventListeners();
}

async function fetchLeads() {
  try {
    const params = new URLSearchParams();

    // Add filters
    const searchTerm = document.querySelector(".search-input").value;
    const platformFilter = document.getElementById("platformFilter").value;
    const followupFilter = document.getElementById("followupFilter").value;
    const userFilter = document.getElementById("userFilter").value;

    if (searchTerm) params.append("search", searchTerm);
    if (platformFilter) params.append("platform", platformFilter);
    if (followupFilter) params.append("followup", followupFilter);
    if (userFilter) params.append("assigned_user_id", userFilter);

    const response = await fetch(`${API_BASE}/leads?${params}`);
    leads = await response.json();

    // Transform data to match frontend format
    leads = leads.map((lead) => ({
      id: lead.id.toString(),
      contactName: lead.contact_name,
      company: lead.company,
      platform: lead.platform,
      dealValue: lead.deal_value,
      assignedUser: lead.assigned_user_name,
      followupDate: lead.followup_date,
      notes: lead.notes,
      stage: lead.stage,
      createdAt: lead.created_at,
      lastUpdated: lead.updated_at,
      timeline: lead.timeline || [],
      assignedUserId: lead.assigned_user_id,
    }));

    filteredLeads = [...leads];
    renderPipeline();
    updateStats();
  } catch (error) {
    console.error("Error fetching leads:", error);
  }
}

// Populate user dropdowns
function populateUserDropdowns() {
  const userFilter = document.getElementById("userFilter");
  const assignedUserSelect = document.getElementById("assignedUser");

  // Clear existing options except the first one
  userFilter.innerHTML = '<option value="">All Users</option>';
  assignedUserSelect.innerHTML = '<option value="">Select user</option>';

  // Add user options
  users.forEach((user) => {
    if (user.name !== "Admin") {
      userFilter.innerHTML += `<option value="${user.id}">${user.name}</option>`;
      assignedUserSelect.innerHTML += `<option value="${user.id}">${user.name}</option>`;
    }
  });
}

// Apply filters
function applyFilters() {
  const searchTerm = document
    .querySelector(".search-input")
    .value.toLowerCase();
  const platformFilter = document.getElementById("platformFilter").value;
  const followupFilter = document.getElementById("followupFilter").value;
  const userFilter = document.getElementById("userFilter").value;

  filteredLeads = leads.filter((lead) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      lead.contactName.toLowerCase().includes(searchTerm) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm));

    // Platform filter
    const matchesPlatform = !platformFilter || lead.platform === platformFilter;

    // User filter
    const matchesUser = !userFilter || lead.assignedUserId == userFilter;

    // Follow-up filter
    let matchesFollowup = true;
    if (followupFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (followupFilter === "overdue") {
        matchesFollowup =
          lead.followupDate && new Date(lead.followupDate) < today;
      } else if (followupFilter === "today") {
        matchesFollowup =
          lead.followupDate &&
          new Date(lead.followupDate).toDateString() === today.toDateString();
      } else if (followupFilter === "week") {
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        matchesFollowup =
          lead.followupDate &&
          new Date(lead.followupDate) >= today &&
          new Date(lead.followupDate) <= weekFromNow;
      } else if (followupFilter === "none") {
        matchesFollowup = !lead.followupDate;
      }
    }

    return matchesSearch && matchesPlatform && matchesFollowup && matchesUser;
  });

  renderPipeline();
}

// Render pipeline view
function renderPipeline() {
  const pipelineEl = document.getElementById("pipeline");

  pipelineEl.innerHTML = stages
    .map((stage) => {
      const stageLeads = filteredLeads.filter(
        (lead) => lead.stage === stage.id
      );
      const totalValue = stageLeads.reduce(
        (sum, lead) => sum + (parseFloat(lead.dealValue) || 0),
        0
      );

      return `
              <div class="stage" data-stage="${stage.id}">
                  <div class="stage-header">
                      <h3 class="stage-title">
                          ${stage.title}
                          <span class="stage-count">${stageLeads.length}</span>
                      </h3>
                      ${
                        totalValue > 0
                          ? `<div class="stage-value">$${totalValue}</div>`
                          : ""
                      }
                  </div>
                  <div class="stage-cards" ondrop="handleDrop(event, '${
                    stage.id
                  }')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
                      ${stageLeads.map((lead) => renderLeadCard(lead)).join("")}
                  </div>
                  ${
                    stage.id === "cold"
                      ? `
                      <div class="quick-add">
                          <button class="quick-add-btn" onclick="openModal()">+ Add Lead</button>
                      </div>
                  `
                      : ""
                  }
              </div>
          `;
    })
    .join("");
}

// Render individual lead card
function renderLeadCard(lead) {
  const followupInfo = getFollowupInfo(lead.followupDate);

  return `
          <div class="lead-card" draggable="true" ondragstart="handleDragStart(event, '${
            lead.id
          }')" data-lead-id="${lead.id}">
              <div class="lead-header">
                  <div class="lead-info">
                      <div class="lead-name">${lead.contactName}</div>
                      ${
                        lead.company
                          ? `<div class="lead-company">${lead.company}</div>`
                          : ""
                      }
                  </div>
                  ${
                    lead.dealValue
                      ? `<div class="lead-value">$${lead.dealValue.toLocaleString()}</div>`
                      : ""
                  }
              </div>
              <div class="lead-meta">
                  <span class="platform-badge">${getPlatformIcon(
                    lead.platform
                  )} ${lead.platform}</span>
                  ${
                    lead.assignedUser
                      ? `
                      <span class="lead-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                          </svg>
                          ${lead.assignedUser}
                      </span>
                  `
                      : ""
                  }
                  ${
                    lead.followupDate
                      ? `
                      <span class="lead-meta-item ${followupInfo.className}">
                          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          ${followupInfo.text}
                      </span>
                  `
                      : ""
                  }
              </div>
          </div>
      `;
}

// Platform icons
function getPlatformIcon(platform) {
  const icons = {
    LinkedIn:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
    Instagram:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.405a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z"/></svg>',
    TikTok:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    Upwork:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076.008-.042c.207-1.143.849-3.06 2.839-3.06 1.492 0 2.703 1.212 2.703 2.703-.001 1.489-1.212 2.702-2.704 2.702zm0-8.14c-2.539 0-4.51 1.649-5.31 4.366-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112c-.002 1.406-1.141 2.546-2.547 2.548-1.405-.002-2.543-1.143-2.545-2.548V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303 2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109 3 0 5.439-2.452 5.439-5.45 0-3-2.439-5.439-5.439-5.439z"/></svg>',
    Fiverr:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/></svg>',
    Contra:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    Email:
      '<svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    Other:
      '<svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  };
  return icons[platform] || icons["Other"];
}

// Get follow-up info
function getFollowupInfo(date) {
  if (!date) return { text: "", className: "" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const followup = new Date(date);
  followup.setHours(0, 0, 0, 0);

  const diffTime = followup - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)}d overdue`,
      className: "overdue",
    };
  } else if (diffDays === 0) {
    return { text: "Today", className: "due-soon" };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", className: "due-soon" };
  } else if (diffDays <= 7) {
    return { text: `${diffDays}d`, className: "" };
  } else {
    return {
      text: followup.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      className: "",
    };
  }
}

// Timeline functions
function toggleActivityForm() {
  const form = document.getElementById("activityForm");
  form.classList.toggle("active");
  if (form.classList.contains("active")) {
    // Set current date/time
    const now = new Date();
    const localDateTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);
    document.getElementById("activityDate").value = localDateTime;
    document.getElementById("activityDescription").value = "";
    document.getElementById("activityDescription").focus();
  }
}

function renderTimeline(lead) {
  const timelineEl = document.getElementById("timeline");

  if (!lead.timeline || lead.timeline.length === 0) {
    timelineEl.innerHTML =
      '<div class="timeline-empty">No activities yet. Add your first interaction!</div>';
    return;
  }

  const timelineHTML = lead.timeline
    .map((activity) => {
      const activityDate = new Date(activity.date);
      const formattedDate = activityDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const icon = getActivityIcon(activity.type);

      return `
              <div class="timeline-item">
                  <div class="timeline-dot ${activity.type}">
                      ${icon}
                  </div>
                  <div class="timeline-content">
                      <div class="timeline-meta">
                          <span class="timeline-type">${activity.type}</span>
                          <span class="timeline-date">${formattedDate}</span>
                          <span class="timeline-user">${activity.user}</span>
                      </div>
                      <div class="timeline-description">${escapeHtml(
                        activity.description
                      )}</div>
                  </div>
              </div>
          `;
    })
    .join("");

  timelineEl.innerHTML = timelineHTML;
}

function getActivityIcon(type) {
  const icons = {
    call: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>',
    email:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
    meeting:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
  };
  return icons[type] || icons.note;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Update statistics
function updateStats() {
  const total = leads.length;
  const won = leads.filter((l) => l.stage === "won").length;
  const active = leads.filter((l) =>
    ["contacted", "warm", "negotiating"].includes(l.stage)
  ).length;
  const overdue = leads.filter((l) => {
    if (!l.followupDate || l.stage === "won" || l.stage === "lost")
      return false;
    return new Date(l.followupDate) < new Date();
  }).length;

  document.getElementById("totalLeads").textContent = total;
  document.getElementById("conversionRate").textContent =
    total > 0 ? Math.round((won / total) * 100) + "%" : "0%";
  document.getElementById("activeDeals").textContent = active;
  document.getElementById("overdueFollowups").textContent = overdue;
}

// Drag and Drop handlers
let draggedLeadId = null;
let isDragging = false;

function handleDragStart(e, leadId) {
  draggedLeadId = leadId;
  isDragging = true;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/html", e.target.innerHTML);
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  // Only reset isDragging if enough time has passed (to prevent click right after drag)
  setTimeout(() => {
    isDragging = false;
    draggedLeadId = null;
  }, 50);
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

async function handleDrop(e, stageId) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const leadId = draggedLeadId;
  if (leadId) {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      const updatedData = {
        contactName: lead.contactName,
        company: lead.company,
        platform: lead.platform,
        dealValue: lead.dealValue,
        assignedUserId:
          users.find((u) => u.name === lead.assignedUser)?.id || null,
        followupDate: lead.followupDate,
        notes: lead.notes,
        stage: stageId,
      };

      editingLeadId = leadId;
      await saveLead(updatedData);
      editingLeadId = null;
    }
  }
  isDragging = false;
  draggedLeadId = null;
}

// Modal functions
function openModal(leadId = null) {
  const modal = document.getElementById("leadModal");
  const modalTitle = modal.querySelector(".modal-title");
  const submitBtn = document.getElementById("submitBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  const timelineSection = document.getElementById("timelineSection");
  const assignedUserGroup = document
    .getElementById("assignedUser")
    .closest(".form-group");
  const assignedUserSelect = document.getElementById("assignedUser");

  if (!modal || !modalTitle || !submitBtn) {
    return;
  }

  // Check if current user is admin
  const isAdmin = currentUser?.role === "admin";

  if (leadId) {
    // Edit mode
    editingLeadId = leadId;
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      modalTitle.textContent = "Edit Lead";
      submitBtn.textContent = "Update Lead";
      if (deleteBtn) deleteBtn.style.display = "block";
      if (timelineSection) timelineSection.style.display = "block";

      // Show/hide assigned user based on admin status
      if (assignedUserGroup) {
        if (isAdmin) {
          assignedUserGroup.style.display = "block";
          assignedUserSelect.disabled = false;
        } else {
          assignedUserGroup.style.display = "none";
          assignedUserSelect.disabled = true;
        }
      }

      if (lead.assignedUserId) {
        const assignedUser = users.find((u) => u.id === lead.assignedUserId);
        if (assignedUser) {
          document.getElementById("assignedUser").value = assignedUser.id;
        }
      }

      // Populate form with existing data
      document.getElementById("contactName").value = lead.contactName;
      document.getElementById("company").value = lead.company || "";
      document.getElementById("platform").value = lead.platform;
      document.getElementById("dealValue").value = lead.dealValue || "";
      const dateValue = lead?.followupDate?.split("T")[0];
      if (dateValue) document.getElementById("followupDate").value = dateValue;
      document.getElementById("notes").value = lead.notes || "";

      // Render timeline
      renderTimeline(lead);
    }
  } else {
    // Add mode
    editingLeadId = null;
    modalTitle.textContent = "Add New Lead";
    submitBtn.textContent = "Add Lead";
    if (deleteBtn) deleteBtn.style.display = "none";
    if (timelineSection) timelineSection.style.display = "none";

    // Show/hide assigned user based on admin status
    if (assignedUserGroup) {
      if (isAdmin) {
        assignedUserGroup.style.display = "block";
        assignedUserSelect.disabled = false;
        // Set default to current user for admin
        assignedUserSelect.value = currentUser.id;
      } else {
        assignedUserGroup.style.display = "none";
        assignedUserSelect.disabled = true;
      }
    }

    document.getElementById("leadForm").reset();

    // If admin, set default assigned user to current user
    if (isAdmin) {
      assignedUserSelect.value = currentUser.id;
    }
  }

  // Hide activity form
  const activityForm = document.getElementById("activityForm");
  if (activityForm) activityForm.classList.remove("active");

  modal.classList.add("active");
}

function closeModal() {
  document.getElementById("leadModal").classList.remove("active");
  document.getElementById("leadForm").reset();
  editingLeadId = null;
}

function editLead(leadId) {
  // Prevent edit if currently dragging
  if (!isDragging) {
    openModal(leadId);
  }
}

// Form submission
document.getElementById("leadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  let assignedUserId;
  let assignedUser;

  const isAdmin = currentUser?.role === "admin";

  if (editingLeadId) {
    // For editing
    if (isAdmin) {
      // Admin can change assigned user
      assignedUserId = document.getElementById("assignedUser").value;
      assignedUser = users.find((u) => u.id == assignedUserId);
    } else {
      // Non-admin keeps existing assignment
      const existingLead = leads.find((l) => l.id === editingLeadId);
      assignedUserId = existingLead?.assignedUserId;
      assignedUser = users.find((u) => u.id == assignedUserId);
    }
  } else {
    // For new leads
    if (isAdmin) {
      // Admin can select user (or defaults to current user)
      assignedUserId =
        document.getElementById("assignedUser").value || currentUser.id;
      assignedUser = users.find((u) => u.id == assignedUserId) || currentUser;
    } else {
      // Non-admin gets auto-assigned to current user
      assignedUserId = currentUser?.id;
      assignedUser = currentUser;
    }
  }

  const leadData = {
    contactName: document.getElementById("contactName").value,
    company: document.getElementById("company").value,
    platform: document.getElementById("platform").value,
    dealValue: parseFloat(document.getElementById("dealValue").value) || 0,
    assignedUserId: assignedUser ? assignedUser.id : null,
    followupDate: document.getElementById("followupDate").value,
    notes: document.getElementById("notes").value,
    stage: editingLeadId
      ? leads.find((l) => l.id === editingLeadId)?.stage || "cold"
      : "cold",
  };

  await saveLead(leadData);
});

async function fetchUsers() {
  try {
    const response = await fetch(`${API_BASE}/users`);
    users = await response.json();
    populateUserDropdowns();
  } catch (error) {
    console.error("Error fetching users:", error);
  }
}

async function saveLead(leadData) {
  try {
    const apiData = {
      contact_name: leadData.contactName,
      company: leadData.company,
      platform: leadData.platform,
      deal_value: leadData.dealValue,
      assigned_user_id: leadData.assignedUserId,
      followup_date: leadData.followupDate,
      notes: leadData.notes,
      stage: leadData.stage,
    };
    if (editingLeadId) {
      await fetch(`${API_BASE}/leads/${editingLeadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });
    } else {
      await fetch(`${API_BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });
    }

    await fetchLeads();
    closeModal();
  } catch (error) {
    console.error("Error saving lead:", error);
    alert("Error saving lead. Please try again.");
  }
}

async function removeLeadFromDB(leadId) {
  try {
    await fetch(`${API_BASE}/leads/${leadId}`, {
      method: "DELETE",
    });
    await fetchLeads();
  } catch (error) {
    console.error("Error deleting lead:", error);
    alert("Error deleting lead. Please try again.");
  }
}

async function addActivity() {
  if (!editingLeadId) return;

  const type = document.getElementById("activityType").value;
  const date = document.getElementById("activityDate").value;
  const description = document
    .getElementById("activityDescription")
    .value.trim();

  if (!description) {
    alert("Please add a description for the activity");
    return;
  }

  const activityData = {
    type,
    date: date || new Date().toISOString(),
    description,
    userId: currentUser?.id || null,
  };

  await saveActivity(editingLeadId, activityData);
  toggleActivityForm();
}

async function saveActivity(leadId, activityData) {
  try {
    const apiData = {
      type: activityData.type,
      description: activityData.description,
      activity_date: activityData.date,
      user_id: activityData.userId,
    };

    await fetch(`${API_BASE}/leads/${leadId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiData),
    });

    await fetchLeads();
  } catch (error) {
    console.error("Error saving activity:", error);
    alert("Error saving activity. Please try again.");
  }
}

// Add this helper somewhere above saveLead
async function addInitialActivity(leadId) {
  const apiData = {
    type: "note",
    description: "Lead created",
    activity_date: new Date().toISOString(),
    user_id: currentUser?.id || null,
  };

  await fetch(`${API_BASE}/leads/${leadId}/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apiData),
  });
}

async function deleteLead() {
  if (editingLeadId && confirm("Are you sure you want to delete this lead?")) {
    await removeLeadFromDB(editingLeadId);
    closeModal();
  }
}

// Setup event listeners
function setupEventListeners() {
  // Filter event listeners
  document
    .querySelector(".search-input")
    .addEventListener("input", applyFilters);
  document
    .getElementById("platformFilter")
    .addEventListener("change", applyFilters);
  document
    .getElementById("followupFilter")
    .addEventListener("change", applyFilters);
  document
    .getElementById("userFilter")
    .addEventListener("change", applyFilters);

  // Close modal on outside click
  document.getElementById("leadModal").addEventListener("click", (e) => {
    if (e.target.id === "leadModal") {
      closeModal();
    }
  });

  // Click event for lead cards
  document.addEventListener("click", (e) => {
    // Check if click is on a lead card
    const leadCard = e.target.closest(".lead-card");
    if (leadCard && !leadCard.classList.contains("dragging")) {
      const leadId = leadCard.dataset.leadId;
      if (leadId && !isDragging) {
        editLead(leadId);
      }
    }
  });
}

// Initialize the app
init();
