// --- Admin Panel Script (admin_script.js) ---

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_BASE_URL = 'https://casheye-production.up.railway.app/api/admin'; // CHANGE THIS (HTTPS for production)
    let currentAdminAuthToken = localStorage.getItem('adminAuthToken');
    let currentEditingUserId = null;
    let demoAdmins = [{ username: 'professor', isDefault: true }];
    let allManageablePlansCache = []; // Cache for plans in Manage Plans section

    // --- DOM Element References ---
    const loginSection = document.getElementById('loginSection');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const loginErrorEl = document.getElementById('loginError');
    const adminPanelSection = document.getElementById('adminPanelSection');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const adminSidebar = document.getElementById('adminSidebar');
    const adminNavLinks = adminSidebar.querySelectorAll('nav ul li button');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');

    const totalUsersCountEl = document.getElementById('totalUsersCount');
    const pendingDepositsCountEl = document.getElementById('pendingDepositsCount');
    const pendingWithdrawalsCountEl = document.getElementById('pendingWithdrawalsCount');
    const totalPlatformBalanceEl = document.getElementById('totalPlatformBalance');

    const usersSection = document.getElementById('users');
    const userSearchInput = document.getElementById('userSearchInput');
    const usersTableBody = document.getElementById('usersTableBody');

    const userProfileSection = document.getElementById('userProfileSection');
    const userProfileHeadingEl = document.getElementById('userProfileHeading');
    const backToUsersBtn = document.getElementById('backToUsersBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const profileUserNameEl = document.getElementById('profileUserName');
    const profileUserEmailEl = document.getElementById('profileUserEmail');
    const profileUserStatusEl = document.getElementById('profileUserStatus');
    const profileUserBalanceEl = document.getElementById('profileUserBalance');
    const profileUserReferralCodeEl = document.getElementById('profileUserReferralCode');
    const profileUserReferredByEl = document.getElementById('profileUserReferredBy');
    const profileUserHasInvestedEl = document.getElementById('profileUserHasInvested');
    const profileUserActivePlanEl = document.getElementById('profileUserActivePlan');
    const profileUserLastCheckInEl = document.getElementById('profileUserLastCheckIn');
    const profileReferralsByNameEl = document.getElementById('profileReferralsByName');
    const profileTransactionsForNameEl = document.getElementById('profileTransactionsForName');
    const editProfileUserNameInput = document.getElementById('editProfileUserName');
    const editProfileUserStatusSelect = document.getElementById('editProfileUserStatus');
    const editProfileUserBalanceInput = document.getElementById('editProfileUserBalance');
    const profileReferralsTableBody = document.getElementById('profileReferralsTableBody');
    const profileNoReferralsMsg = document.getElementById('profileNoReferralsMsg');
    const profileTransactionsTableBody = document.getElementById('profileTransactionsTableBody');
    const profileNoTransactionsMsg = document.getElementById('profileNoTransactionsMsg');

    const pendingDepositsTableBody = document.getElementById('pendingDepositsTableBody');
    const pendingWithdrawalsTableBody = document.getElementById('pendingWithdrawalsTableBody');
    const allHistorySearchInput = document.getElementById('allHistorySearchInput');
    const allHistoryTableBody = document.getElementById('allHistoryTableBody');

    const depositSettingsForm = document.getElementById('depositSettingsForm');
    const epSettingNameInput = document.getElementById('epSettingName');
    const epSettingNumberInput = document.getElementById('epSettingNumber');
    const epSettingInstructionsTextarea = document.getElementById('epSettingInstructions');
    const jcSettingNameInput = document.getElementById('jcSettingName');
    const jcSettingNumberInput = document.getElementById('jcSettingNumber');
    const jcSettingInstructionsTextarea = document.getElementById('jcSettingInstructions');
    const adminPlansTableBody = document.getElementById('adminPlansTableBody'); // For "Settings" page read-only view

    // DOM Elements for "Manage Plans" section
    const planFormHeadingEl = document.getElementById('planFormHeading');
    const managePlanForm = document.getElementById('managePlanForm');
    const planIdInput = document.getElementById('planIdInput');
    const planNameInput = document.getElementById('planNameInput');
    const planInvestmentAmountInput = document.getElementById('planInvestmentAmountInput');
    const planDailyReturnInput = document.getElementById('planDailyReturnInput');
    const planDurationDaysInput = document.getElementById('planDurationDaysInput');
    const planDescriptionTextarea = document.getElementById('planDescriptionTextarea');
    const planIsActiveCheckbox = document.getElementById('planIsActiveCheckbox');
    const savePlanBtnEl = document.getElementById('savePlanBtn'); // Specific save button for plans
    const clearPlanFormBtn = document.getElementById('clearPlanFormBtn');
    const existingPlansTableBody = document.getElementById('existingPlansTableBody'); // For "Manage Plans" interactive table

    const addAdminForm = document.getElementById('addAdminForm');
    const newAdminUserInput = document.getElementById('newAdminUser');
    const newAdminPassInput = document.getElementById('newAdminPass');
    const adminListBody = document.getElementById('adminListBody');


    // --- Helper Functions ---
    async function apiRequest(endpoint, method = 'GET', body = null, requiresAuth = true) {
        const headers = { 'Content-Type': 'application/json' };
        if (requiresAuth && currentAdminAuthToken) {
            headers['Authorization'] = `Bearer ${currentAdminAuthToken}`;
        }

        const config = { method, headers };
        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            if (response.status === 401 && requiresAuth) {
                handleAdminLogout();
                return { success: false, message: 'Session expired. Please login again.' };
            }
            if (response.status === 204) return { success: true, data: null };

            const responseData = await response.json();
            if (!response.ok) {
                return { success: false, message: responseData.message || `Error: ${response.status}` };
            }
            return { success: true, data: responseData.data || responseData };
        } catch (error) {
            console.error(`API Admin request to ${endpoint} failed:`, error);
            return { success: false, message: 'Network error or server is unreachable.' };
        }
    }

    function storeAdminAuthToken(token) {
        currentAdminAuthToken = token;
        localStorage.setItem('adminAuthToken', token);
    }

    function clearAdminAuthToken() {
        currentAdminAuthToken = null;
        localStorage.removeItem('adminAuthToken');
    }

    function updateAdminUIVisibility(isLoggedIn) {
        if (isLoggedIn) {
            loginSection.classList.add('hidden');
            adminPanelSection.classList.remove('hidden');
            document.body.classList.remove('sidebar-visible');
        } else {
            loginSection.classList.remove('hidden');
            adminPanelSection.classList.add('hidden');
            document.body.classList.remove('sidebar-visible');
        }
    }

    function createTableMessageRow(tbodyEl, message, colSpan) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        // Ensure tbodyEl.previousElementSibling and its rows[0] exist before accessing cells
        if (tbodyEl.previousElementSibling && tbodyEl.previousElementSibling.rows[0] && tbodyEl.previousElementSibling.rows[0].cells) {
             td.colSpan = colSpan || tbodyEl.previousElementSibling.rows[0].cells.length;
        } else {
            td.colSpan = colSpan || 1; // Default colspan if header can't be determined
        }
        td.className = 'no-data-message';
        td.textContent = message;
        tr.appendChild(td);
        return tr;
    }


    function showLoadingMessage(tbodyEl, message = "Loading...", colSpan) {
        tbodyEl.innerHTML = ''; // Clear previous
        tbodyEl.appendChild(createTableMessageRow(tbodyEl, message, colSpan));
    }
    function showNoDataMessage(tbodyEl, message = "No data available.", colSpan) {
        tbodyEl.innerHTML = ''; // Clear previous
        tbodyEl.appendChild(createTableMessageRow(tbodyEl, message, colSpan));
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    }

    // --- Authentication ---
    async function handleAdminLogin(event) {
        event.preventDefault();
        const username = adminLoginForm.username.value;
        const password = adminLoginForm.password.value;
        loginErrorEl.textContent = '';

        const result = await apiRequest('/auth/login', 'POST', { username, password }, false);

        if (result.success && result.data.token) {
            storeAdminAuthToken(result.data.token);
            updateAdminUIVisibility(true);
            showAdminSection('dashboard');
            adminLoginForm.reset();
        } else {
            loginErrorEl.textContent = result.message || 'Login failed. Please check credentials.';
        }
    }

    function handleAdminLogout() {
        clearAdminAuthToken();
        updateAdminUIVisibility(false);
    }

    // --- Sidebar and Navigation ---
    function toggleSidebar() {
        document.body.classList.toggle('sidebar-visible');
    }

    function showAdminSection(sectionId) {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            loadSectionData(sectionId);
        }

        adminNavLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });
        if (document.body.classList.contains('sidebar-visible') && window.innerWidth < 768) {
            toggleSidebar();
        }
    }

    function loadSectionData(sectionId) {
        switch (sectionId) {
            case 'dashboard': fetchDashboardData(); break;
            case 'users': fetchUsers(); break;
            case 'deposits': fetchPendingDeposits(); break;
            case 'withdrawals': fetchPendingWithdrawals(); break;
            case 'history': fetchAllTransactions(); break;
            case 'settings': fetchPlatformSettings(); break;
            case 'managePlans':
                fetchAndRenderManageablePlans();
                resetPlanForm();
                break;
            case 'manageAdmins': renderAdminList(); break;
        }
    }

    // --- Dashboard Section ---
    async function fetchDashboardData() {
        const result = await apiRequest('/dashboard/stats');
        if (result.success && result.data) {
            totalUsersCountEl.textContent = result.data.totalUsers || 0;
            pendingDepositsCountEl.textContent = result.data.pendingDeposits || 0;
            pendingWithdrawalsCountEl.textContent = result.data.pendingWithdrawals || 0;
            totalPlatformBalanceEl.textContent = `${result.data.totalPlatformBalance || '0.00'} PKR`;
        } else {
            totalUsersCountEl.textContent = 'Error';
            pendingDepositsCountEl.textContent = 'Error';
            pendingWithdrawalsCountEl.textContent = 'Error';
            totalPlatformBalanceEl.textContent = 'Error';
        }
    }

    // --- Manage Users Section ---
    async function fetchUsers(searchTerm = '') {
        showLoadingMessage(usersTableBody, "Loading users...");
        const result = await apiRequest(`/users${searchTerm ? '?search=' + encodeURIComponent(searchTerm) : ''}`);
        if (result.success && Array.isArray(result.data)) {
            renderUsersTable(result.data);
        } else {
            showNoDataMessage(usersTableBody, result.message || "Could not load users.");
        }
    }

    function renderUsersTable(users) {
        usersTableBody.innerHTML = '';
        if (users.length === 0) {
            showNoDataMessage(usersTableBody);
            return;
        }
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${(user.balance || 0).toFixed(2)}</td>
                <td><span class="status-${(user.status || 'unknown').toLowerCase().replace(/[^a-z0-9_-]/gi, '')}">${user.status || 'Unknown'}</span></td>
                <td>
                    <button type="button" class="action-btn btn-view" data-user-id="${user.id}">View</button>
                    <button type="button" class="action-btn ${user.status === 'Blocked' ? 'btn-unblock' : 'btn-block'}" data-user-id="${user.id}" data-action="${user.status === 'Blocked' ? 'unblock' : 'block'}">
                        ${user.status === 'Blocked' ? 'Unblock' : 'Block'}
                    </button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
    }

    async function handleUserAction(userId, action) {
        let endpoint = '';
        if (action === 'block') endpoint = `/users/${userId}/block`;
        else if (action === 'unblock') endpoint = `/users/${userId}/unblock`;
        else return;

        const result = await apiRequest(endpoint, 'POST');
        if (result.success) {
            alert(`User ${action}ed successfully.`);
            fetchUsers(userSearchInput.value); // Refresh user list
            if (currentEditingUserId === userId && userProfileSection.classList.contains('active')) { // If viewing this user, refresh profile
                viewUserProfile(userId);
            }
            fetchDashboardData(); // Refresh dashboard stats if user status changes affect counts
        } else {
            alert(`Failed to ${action} user: ${result.message}`);
        }
    }

    // --- User Profile Section ---
    async function viewUserProfile(userId) {
        currentEditingUserId = userId; // Store string ID
        showAdminSection('userProfileSection'); // This already calls loadSectionData which isn't ideal for this specific view.
                                                // We manually load profile data.
        userProfileSection.classList.add('active'); // Ensure it's active if showAdminSection was bypassed

        userProfileHeadingEl.textContent = 'Loading Profile...';
        [profileUserNameEl, profileUserEmailEl, profileUserStatusEl, profileUserBalanceEl,
         profileUserReferralCodeEl, profileUserReferredByEl, profileUserHasInvestedEl,
         profileUserActivePlanEl, profileUserLastCheckInEl, profileReferralsByNameEl,
         profileTransactionsForNameEl].forEach(el => el.textContent = '...');
        showLoadingMessage(profileReferralsTableBody, "Loading referrals...", 3);
        showLoadingMessage(profileTransactionsTableBody, "Loading transactions...", 5);
        profileNoReferralsMsg.classList.add('hidden');
        profileNoTransactionsMsg.classList.add('hidden');
        toggleProfileEditMode(false); // Ensure view mode initially

        const result = await apiRequest(`/users/${userId}/profile`);
        if (result.success && result.data) {
            populateUserProfile(result.data);
        } else {
            userProfileHeadingEl.textContent = 'Error Loading Profile';
            alert(`Failed to load user profile: ${result.message}`);
            // Clear fields or show error messages in fields
        }
    }

    function populateUserProfile(userData) {
        userProfileHeadingEl.textContent = `User Profile: ${userData.name || 'N/A'}`;
        profileUserNameEl.textContent = userData.name || 'N/A';
        profileUserEmailEl.textContent = userData.email || 'N/A';
        profileUserStatusEl.textContent = userData.status || 'N/A';
        profileUserBalanceEl.textContent = (userData.balance || 0).toFixed(2);
        profileUserReferralCodeEl.textContent = userData.referralcode || 'N/A';
        profileUserReferredByEl.textContent = userData.referredbyemail || 'N/A'; // Ensure backend sends this
        profileUserHasInvestedEl.textContent = userData.hasmadefirstinvestment ? 'Yes' : 'No';
        profileUserActivePlanEl.textContent = userData.activeplanname || 'N/A'; // Ensure backend sends this
        profileUserLastCheckInEl.textContent = formatDate(userData.lastcheckin);

        profileReferralsByNameEl.textContent = userData.name || 'this user';
        profileTransactionsForNameEl.textContent = userData.name || 'User';

        editProfileUserNameInput.value = userData.name || '';
        editProfileUserStatusSelect.value = userData.status || 'Active';
        editProfileUserBalanceInput.value = (userData.balance || 0).toFixed(2);

        renderProfileTransactions(userData.transactions || []);
        renderProfileReferrals(userData.referralsMade || []);
    }

    function toggleProfileEditMode(isEditing) {
        userProfileSection.querySelectorAll('.profile-view-field').forEach(el => el.classList.toggle('hidden', isEditing));
        userProfileSection.querySelectorAll('.edit-field').forEach(el => el.classList.toggle('hidden', !isEditing));
        editProfileBtn.classList.toggle('hidden', isEditing);
        saveProfileBtn.classList.toggle('hidden', !isEditing);
        cancelEditBtn.classList.toggle('hidden', !isEditing);
    }

    async function saveUserProfile() {
        if (!currentEditingUserId) return;
        const updatedData = {
            name: editProfileUserNameInput.value,
            status: editProfileUserStatusSelect.value,
            // balance: parseFloat(editProfileUserBalanceInput.value) // Not sending balance
        };
        // WARNING: Balance updates are disallowed from this UI as per backend logic.
        console.warn("Attempting to save profile (name/status only). Backend disallows direct balance update from admin profile edit.");

        const result = await apiRequest(`/users/${currentEditingUserId}/profile`, 'PUT', updatedData);
        if (result.success) {
            alert('Profile updated successfully (name/status only).');
            viewUserProfile(currentEditingUserId); // Refresh view
        } else {
            alert(`Failed to update profile: ${result.message}`);
        }
    }

    function renderProfileTransactions(transactions) {
        profileTransactionsTableBody.innerHTML = '';
        if (transactions.length === 0) {
            showNoDataMessage(profileTransactionsTableBody, "No transactions found for this user.", 5);
            return;
        }
        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.type || 'N/A'}</td>
                <td>${tx.status || 'N/A'}</td>
                <td>${(tx.amount || 0).toFixed(2)}</td>
                <td class="wrap">${tx.description || '-'}</td>
                <td>${formatDate(tx.timestamp)}</td>
            `;
            profileTransactionsTableBody.appendChild(tr);
        });
    }

    function renderProfileReferrals(referrals) {
        profileReferralsTableBody.innerHTML = '';
        if (referrals.length === 0) {
            showNoDataMessage(profileReferralsTableBody, "This user has not referred anyone.", 3);
            return;
        }
        referrals.forEach(ref => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${ref.name || 'N/A'}</td>
                <td>${ref.email || 'N/A'}</td>
                <td>${formatDate(ref.signupDate)}</td>
            `;
            profileReferralsTableBody.appendChild(tr);
        });
    }

    // --- Pending Deposits Section ---
    async function fetchPendingDeposits() {
        showLoadingMessage(pendingDepositsTableBody, "Loading pending deposits...");
        const result = await apiRequest('/transactions/deposits/pending');
        if (result.success && Array.isArray(result.data)) {
            renderPendingDepositsTable(result.data);
        } else {
            showNoDataMessage(pendingDepositsTableBody, result.message || "Could not load pending deposits.");
        }
    }

    function renderPendingDepositsTable(deposits) {
        
        pendingDepositsTableBody.innerHTML = '';
        if (deposits.length === 0) {
            showNoDataMessage(pendingDepositsTableBody, "No pending deposits found.", 6); 
            return;
        }

        deposits.forEach(deposit => {
            const tr = document.createElement('tr');
            let detailsHtml = '';

            if (deposit.transactionidexternal) {
                detailsHtml += deposit.transactionidexternal;
            }

            if (deposit.screenshoturl) {
                if (detailsHtml) detailsHtml += '<br>';
                
                const screenshotpath = deposit.screenshoturl; 

                detailsHtml += `<a href="${screenshotpath}" target="_blank" rel="noopener noreferrer">View Screenshot</a>`;
            }
            
            if (!detailsHtml) {
                detailsHtml = '-';
            }

            tr.innerHTML = `
                <td>${deposit.useremail || 'N/A'}</td>
                <td>${(deposit.amount || 0).toFixed(2)}</td>
                <td>${deposit.method || 'N/A'}</td>
                <td class="wrap">${detailsHtml}</td>
                <td>${formatDate(deposit.submittedat)}</td>
                <td>
                    <button type="button" class="action-btn btn-approve" data-id="${deposit.id}" data-action="approve">Approve</button>
                    <button type="button" class="action-btn btn-reject" data-id="${deposit.id}" data-action="reject">Reject</button>
                </td>
            `;
            pendingDepositsTableBody.appendChild(tr);
        });
    }
    async function handleDepositAction(transactionId, action) {
        const result = await apiRequest(`/transactions/deposits/${transactionId}/${action}`, 'POST');
        if (result.success) {
            alert(`Deposit ${action}ed successfully.`);
            fetchPendingDeposits();
            fetchDashboardData(); // Refresh dashboard counts
        } else {
            alert(`Failed to ${action} deposit: ${result.message}`);
        }
    }

    // --- Pending Withdrawals Section ---
    async function fetchPendingWithdrawals() {
        showLoadingMessage(pendingWithdrawalsTableBody, "Loading pending withdrawals...");
        const result = await apiRequest('/transactions/withdrawals/pending');
        if (result.success && Array.isArray(result.data)) {
            renderPendingWithdrawalsTable(result.data);
        } else {
            showNoDataMessage(pendingWithdrawalsTableBody, result.message || "Could not load pending withdrawals.");
        }
    }

    function renderPendingWithdrawalsTable(withdrawals) {
        pendingWithdrawalsTableBody.innerHTML = '';
        if (withdrawals.length === 0) {
            showNoDataMessage(pendingWithdrawalsTableBody);
            return;
        }
        withdrawals.forEach(withdrawal => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${withdrawal.userEmail || 'N/A'}</td>
                <td>${(withdrawal.amount || 0).toFixed(2)}</td>
                <td>${withdrawal.method || 'N/A'}</td>
                <td>${withdrawal.accountNumber || 'N/A'}</td>
                <td>${formatDate(withdrawal.requestedAt)}</td>
                <td>
                    <button type="button" class="action-btn btn-approve" data-id="${withdrawal.id}" data-action="approve">Approve</button>
                    <button type="button" class="action-btn btn-reject" data-id="${withdrawal.id}" data-action="reject">Reject</button>
                </td>
            `;
            pendingWithdrawalsTableBody.appendChild(tr);
        });
    }

    async function handleWithdrawalAction(transactionId, action) {
        const result = await apiRequest(`/transactions/withdrawals/${transactionId}/${action}`, 'POST');
        if (result.success) {
            alert(`Withdrawal ${action}ed successfully.`);
            fetchPendingWithdrawals();
            fetchDashboardData(); // Refresh dashboard counts
        } else {
            alert(`Failed to ${action} withdrawal: ${result.message}`);
        }
    }

    // --- All Transaction History Section ---
    async function fetchAllTransactions(searchTerm = '') {
        showLoadingMessage(allHistoryTableBody, "Loading transaction history...");
        const result = await apiRequest(`/transactions/all${searchTerm ? '?search=' + encodeURIComponent(searchTerm) : ''}`);
        if (result.success && Array.isArray(result.data)) {
            renderAllTransactionsTable(result.data);
        } else {
            showNoDataMessage(allHistoryTableBody, result.message || "Could not load transaction history.");
        }
    }

    function renderAllTransactionsTable(transactions) {
        allHistoryTableBody.innerHTML = '';
        if (transactions.length === 0) {
            showNoDataMessage(allHistoryTableBody);
            return;
        }
        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.userEmail || 'N/A'}</td>
                <td>${tx.type || 'N/A'}</td>
                <td>${tx.status || 'N/A'}</td>
                <td>${(tx.amount || 0).toFixed(2)}</td>
                <td class="wrap">${tx.description || '-'}</td>
                <td>${formatDate(tx.timestamp)}</td>
            `;
            allHistoryTableBody.appendChild(tr);
        });
    }

    // --- Platform Settings Section ---
    async function fetchPlatformSettings() {
        // Deposit Account Settings
        const depositSettingsResult = await apiRequest('/platform/settings/deposit-accounts');
        if (depositSettingsResult.success && depositSettingsResult.data) {
            renderPlatformDepositSettings(depositSettingsResult.data);
        } else {
            console.error("Failed to load deposit settings:", depositSettingsResult.message);
            // Optionally display an error in the form area
        }

        // Investment Plans (for read-only display in settings)
        const plansResult = await apiRequest('/platform/settings/investment-plans');
        if (plansResult.success && Array.isArray(plansResult.data)) {
            renderAdminInvestmentPlans(plansResult.data); // Renders to adminPlansTableBody
        } else {
            showNoDataMessage(adminPlansTableBody, plansResult.message || "Could not load investment plans for settings page.", 5);
        }
    }

    function renderPlatformDepositSettings(settings) {
        if (settings.easypaisa) {
            epSettingNameInput.value = settings.easypaisa.name || '';
            epSettingNumberInput.value = settings.easypaisa.number || '';
            epSettingInstructionsTextarea.value = settings.easypaisa.instructions || '';
        }
        if (settings.jazzcash) {
            jcSettingNameInput.value = settings.jazzcash.name || '';
            jcSettingNumberInput.value = settings.jazzcash.number || '';
            jcSettingInstructionsTextarea.value = settings.jazzcash.instructions || '';
        }
    }

    async function saveDepositSettings(event) {
        event.preventDefault();
        const settingsData = {
            easypaisa: {
                name: epSettingNameInput.value,
                number: epSettingNumberInput.value,
                instructions: epSettingInstructionsTextarea.value
            },
            jazzcash: {
                name: jcSettingNameInput.value,
                number: jcSettingNumberInput.value,
                instructions: jcSettingInstructionsTextarea.value
            }
        };
        const result = await apiRequest('/platform/settings/deposit-accounts', 'PUT', settingsData);
        if (result.success) {
            alert('Deposit settings saved successfully!');
        } else {
            alert(`Failed to save settings: ${result.message}`);
        }
    }

    // Renders plans to the read-only table in "Platform Settings"
    function renderAdminInvestmentPlans(plans) {
        adminPlansTableBody.innerHTML = '';
        if (plans.length === 0) {
            showNoDataMessage(adminPlansTableBody, "No investment plans configured.", 5);
            return;
        }
        plans.forEach(plan => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${plan.name || 'N/A'}</td>
                <td>${(plan.investmentamount || 0).toFixed(2)}</td>
                <td>${(plan.dailyreturn || 0).toFixed(2)}</td>
                <td>${plan.durationdays || 0}</td>
                <td class="wrap">${plan.description || '-'}</td>
            `;
            adminPlansTableBody.appendChild(tr);
        });
    }

    // --- Manage Investment Plans Section --- NEW FUNCTIONS ---
    async function fetchAndRenderManageablePlans() {
        showLoadingMessage(existingPlansTableBody, "Loading plans...", 8);
        const result = await apiRequest('/platform/settings/investment-plans');
        if (result.success && Array.isArray(result.data)) {
            allManageablePlansCache = result.data; // Cache for editing
            renderManageablePlansTable(result.data);
        } else {
            allManageablePlansCache = [];
            showNoDataMessage(existingPlansTableBody, result.message || "Could not load investment plans.", 8);
        }
    }

    function renderManageablePlansTable(plans) {
        existingPlansTableBody.innerHTML = '';
        if (plans.length === 0) {
            showNoDataMessage(existingPlansTableBody, "No investment plans found. Add one using the form above.", 8);
            return;
        }
        plans.forEach(plan => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${plan.id}</td>
                <td>${plan.name || 'N/A'}</td>
                <td>${(plan.investmentamount || 0).toFixed(2)}</td>
                <td>${(plan.dailyreturn || 0).toFixed(2)}</td>
                <td>${plan.durationdays || 0}</td>
                <td class="wrap">${plan.description || '-'}</td>
                <td><span class="status-${plan.isactive ? 'active' : 'inactive'}">${plan.isactive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button type="button" class="action-btn btn-edit" data-plan-id="${plan.id}">Edit</button>
                    <button type="button" class="action-btn ${plan.isactive ? 'btn-block' : 'btn-approve'}" data-plan-id="${plan.id}" data-plan-active="${plan.isActive}">
                        ${plan.isactive ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            `;
            existingPlansTableBody.appendChild(tr);
        });
    }

    function resetPlanForm() {
        if (managePlanForm) managePlanForm.reset();
        if (planIdInput) planIdInput.value = '';
        if (planFormHeadingEl) planFormHeadingEl.textContent = 'Add New Investment Plan';
        if (savePlanBtnEl) savePlanBtnEl.textContent = 'Save Plan';
        if (planIsActiveCheckbox) planIsActiveCheckbox.checked = true;
    }

    function populatePlanForm(plan) {
        if (!plan) {
            alert("Error: Plan data not found for editing.");
            return;
        }
        planFormHeadingEl.textContent = `Edit Investment Plan (ID: ${plan.id})`;
        planIdInput.value = plan.id;
        planNameInput.value = plan.name || '';
        planInvestmentAmountInput.value = (plan.investmentamount || 0).toFixed(2); // Use toFixed to avoid long decimals in input
        planDailyReturnInput.value = (plan.dailyreturn || 0).toFixed(2);
        planDurationDaysInput.value = plan.durationdays || 0;
        planDescriptionTextarea.value = plan.description || '';
        planIsActiveCheckbox.checked = !!plan.isactive; // Ensure boolean
        savePlanBtnEl.textContent = 'Update Plan';
        if (managePlanForm) { // Scroll to form if it exists
             managePlanForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async function handleSavePlanForm(event) {
        event.preventDefault();
        if (!savePlanBtnEl) return;

        savePlanBtnEl.disabled = true;
        const originalButtonText = savePlanBtnEl.textContent;
        savePlanBtnEl.textContent = 'Saving...';

        const planId = planIdInput.value;
        const planData = {
            name: planNameInput.value.trim(),
            investmentAmount: parseFloat(planInvestmentAmountInput.value),
            dailyReturn: parseFloat(planDailyReturnInput.value),
            durationDays: parseInt(planDurationDaysInput.value),
            description: planDescriptionTextarea.value.trim(),
            isActive: planIsActiveCheckbox.checked
        };

        if (!planData.name || isNaN(planData.investmentAmount) || planData.investmentAmount <= 0 ||
            isNaN(planData.dailyReturn) || planData.dailyReturn < 0 || // Daily return can be 0
            isNaN(planData.durationDays) || planData.durationDays <= 0) {
            alert("Please fill all required fields (Name, Amount, Return, Duration) with valid positive values.");
            savePlanBtnEl.disabled = false;
            savePlanBtnEl.textContent = originalButtonText;
            return;
        }

        let result;
        let endpoint = '/platform/settings/investment-plans';
        let method = 'POST';

        if (planId) { // Editing existing plan
            endpoint += `/${planId}`;
            method = 'PUT';
        }

        result = await apiRequest(endpoint, method, planData);

        if (result.success) {
            alert(`Investment plan ${planId ? 'updated' : 'created'} successfully!`);
            resetPlanForm();
            fetchAndRenderManageablePlans(); // Refresh the list
        } else {
            alert(`Failed to ${planId ? 'update' : 'create'} plan: ${result.message}`);
        }
        savePlanBtnEl.disabled = false;
        savePlanBtnEl.textContent = planIdInput.value ? 'Update Plan' : 'Save Plan';
    }

    async function handleTogglePlanActiveStatus(planId, currentIsActive) {
        const newIsActive = !currentIsActive;
        const action = newIsActive ? 'deactivate' : 'activate';

        if (!confirm(`Are you sure you want to ${action} plan ID ${planId}?`)) {
            return;
        }

        const result = await apiRequest(`/platform/settings/investment-plans/${planId}`, 'PUT', { isActive: newIsActive });

        if (result.success) {
            alert(`Plan ID ${planId} ${action}d successfully!`);
            fetchAndRenderManageablePlans();
        } else {
            alert(`Failed to ${action} plan: ${result.message}`);
        }
    }

    // --- Manage Admins (UI Demo) ---
    function renderAdminList() {
        adminListBody.innerHTML = '';
        if (demoAdmins.length === 0) {
            showNoDataMessage(adminListBody, "No admins in UI demo list.", 2);
            return;
        }
        demoAdmins.forEach(admin => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${admin.username}</td>
                <td>
                    <button type="button" class="action-btn btn-reject" data-username="${admin.username}" ${admin.isDefault ? 'disabled title="Cannot remove default admin"' : ''}>
                        Remove
                    </button>
                </td>
            `;
            adminListBody.appendChild(tr);
        });
    }

    function handleAddAdminFormSubmit(event) {
        event.preventDefault();
        const username = newAdminUserInput.value.trim();
        const password = newAdminPassInput.value;

        if (!username || !password) {
            alert("Please enter username and password for the new admin (UI Demo).");
            return;
        }
        if (demoAdmins.find(admin => admin.username === username)) {
            alert("Admin with this username already exists in UI Demo list.");
            return;
        }
        demoAdmins.push({ username, isDefault: false });
        renderAdminList();
        addAdminForm.reset();
        alert(`Admin "${username}" added to UI Demo list. This is not a real backend change.`);
    }

    function removeAdminFromList(username) {
        demoAdmins = demoAdmins.filter(admin => admin.username !== username);
        renderAdminList();
        alert(`Admin "${username}" removed from UI Demo list. This is not a real backend change.`);
    }

    // --- Event Listeners ---
    if (adminLoginForm) adminLoginForm.addEventListener('submit', handleAdminLogin);
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleAdminLogout);
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);

    if (adminNavLinks) {
        adminNavLinks.forEach(link => {
            link.addEventListener('click', () => showAdminSection(link.dataset.section));
        });
    }

    if (userSearchInput) userSearchInput.addEventListener('input', (e) => fetchUsers(e.target.value));
    if (usersTableBody) {
        usersTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-view') && e.target.dataset.userId) {
                viewUserProfile(e.target.dataset.userId);
            } else if (e.target.dataset.userId && e.target.dataset.action) {
                if (confirm(`Are you sure you want to ${e.target.dataset.action} this user?`)) {
                    handleUserAction(e.target.dataset.userId, e.target.dataset.action);
                }
            }
        });
    }

    if (backToUsersBtn) {
        backToUsersBtn.addEventListener('click', () => {
            currentEditingUserId = null;
            showAdminSection('users');
        });
    }
    if (editProfileBtn) editProfileBtn.addEventListener('click', () => toggleProfileEditMode(true));
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if (currentEditingUserId) viewUserProfile(currentEditingUserId); // Re-fetch to discard changes
            else toggleProfileEditMode(false);
        });
    }
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveUserProfile);

    if (pendingDepositsTableBody) {
        pendingDepositsTableBody.addEventListener('click', (e) => {
            if (e.target.dataset.id && e.target.dataset.action) {
                if (confirm(`Are you sure you want to ${e.target.dataset.action} this deposit?`)) {
                    handleDepositAction(e.target.dataset.id, e.target.dataset.action);
                }
            }
        });
    }
    if (pendingWithdrawalsTableBody) {
        pendingWithdrawalsTableBody.addEventListener('click', (e) => {
            if (e.target.dataset.id && e.target.dataset.action) {
                if (confirm(`Are you sure you want to ${e.target.dataset.action} this withdrawal?`)) {
                    handleWithdrawalAction(e.target.dataset.id, e.target.dataset.action);
                }
            }
        });
    }
    if (allHistorySearchInput) allHistorySearchInput.addEventListener('input', (e) => fetchAllTransactions(e.target.value));
    if (depositSettingsForm) depositSettingsForm.addEventListener('submit', saveDepositSettings);

    // Event Listeners for Manage Plans
    if (managePlanForm) {
        managePlanForm.addEventListener('submit', handleSavePlanForm);
    }
    if (clearPlanFormBtn) {
        clearPlanFormBtn.addEventListener('click', resetPlanForm);
    }
    if (existingPlansTableBody) {
        existingPlansTableBody.addEventListener('click', (e) => {
            const target = e.target;
            const planId = target.dataset.planId;

            if (target.classList.contains('btn-edit') && planId) {
                const planToEdit = allManageablePlansCache.find(p => p.id.toString() === planId);
                if (planToEdit) {
                    populatePlanForm(planToEdit);
                } else {
                    alert("Could not find plan details to edit. Please refresh.");
                    console.error("Plan not found in cache for ID:", planId, "Cache:", allManageablePlansCache);
                }
            } else if (planId && target.dataset.planActive !== undefined) {
                const isActive = target.dataset.planActive === 'true';
                handleTogglePlanActiveStatus(planId, isActive);
            }
        });
    }
    
    if (addAdminForm) addAdminForm.addEventListener('submit', handleAddAdminFormSubmit);
    if (adminListBody) {
        adminListBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-reject') && e.target.dataset.username) {
                if (!e.target.disabled && confirm(`UI Demo: Remove admin "${e.target.dataset.username}" from the list?`)) {
                    removeAdminFromList(e.target.dataset.username);
                }
            }
        });
    }

    // --- Initial Load ---
    if (currentAdminAuthToken) {
        updateAdminUIVisibility(true);
        showAdminSection('dashboard');
    } else {
        updateAdminUIVisibility(false);
    }
});