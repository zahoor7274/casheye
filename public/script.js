// --- Configuration ---
const API_BASE_URL = 'https://casheye-production.up.railway.app/api'; // CHANGE THIS TO YOUR ACTUAL (HTTPS) BACKEND URL IN PRODUCTION

// --- Global State ---
let currentUserData = null;
let currentAuthToken = localStorage.getItem('authToken');
let investmentPlansCache = [];
let platformDepositInfoCache = null;

// --- DOM Element References (Initialized in DOMContentLoaded) ---
let signupPage, loginPage, dashboardPage,
    signupForm, loginForm, depositForm, withdrawForm, changePasswordForm,
    showLoginBtn, showSignupBtn, menuToggleBtn, closeMenuBtn, logoutBtn, menuNav,
    userNameEl, balanceEl, referralCodeEl,
    dailyCheckInSectionEl, checkInStatusTextEl, dailyCheckInButtonEl, nextCheckInTimeEl,
    platformDepositAccountsContainerEl, investmentPlansContainerEl,
    historyListEl, noHistoryMessageEl, referralListEl, noReferralsMessageEl;

// --- Helper Functions ---
async function apiRequest(endpoint, method = 'GET', body = null, requiresAuth = true) {
    const headers = {}; // Content-Type will be set based on body type
    if (requiresAuth && currentAuthToken) {
        headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }

    const config = { method, headers };
    if (body) {
        if (body instanceof FormData) {
            config.body = body;
            // Don't set Content-Type for FormData, browser does it with boundary
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        if (response.status === 401 && requiresAuth) {
            console.warn('Unauthorized request or token expired. Logging out.');
            handleLogout();
            return { success: false, message: 'Session expired. Please login again.' };
        }
        if (response.status === 204) {
            return { success: true, data: null };
        }
        const data = await response.json();
        if (!response.ok) {
            return { success: false, message: data.message || `Error: ${response.status}` };
        }
        return { success: true, data: data.data || data };
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        return { success: false, message: 'Network error or server is unreachable.' };
    }
}

function storeAuthToken(token) {
    currentAuthToken = token;
    localStorage.setItem('authToken', token);
}

function clearAuthToken() {
    currentAuthToken = null;
    localStorage.removeItem('authToken');
}

function updateUIVisibility(isLoggedIn) {
    if (isLoggedIn) {
        signupPage.classList.add('hidden');
        loginPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
    } else {
        signupPage.classList.remove('hidden');
        loginPage.classList.add('hidden');
        dashboardPage.classList.add('hidden');
        currentUserData = null;
    }
}

// --- Authentication Functions ---
async function handleSignup(event) {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const referralCode = formData.get('referralCode');

    const result = await apiRequest('/auth/signup', 'POST', { name, email, password, referralCode }, false);
    if (result.success) {
        alert(result.data.message || 'Signup successful! Please login.');
        showLoginPage();
        signupForm.reset();
    } else {
        alert(`Signup failed: ${result.message}`);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');

    const result = await apiRequest('/auth/login', 'POST', { email, password }, false);
    if (result.success && result.data.token) {
        storeAuthToken(result.data.token);
        await fetchUserProfile();
        updateUIVisibility(true);
        showDashboardSection('home');
        loginForm.reset();
    } else {
        alert(`Login failed: ${result.message || 'Invalid credentials or server error.'}`);
    }
}

function handleLogout() {
    clearAuthToken();
    updateUIVisibility(false);
    showLoginPage();
    if(userNameEl) userNameEl.textContent = 'User';
    if(balanceEl) balanceEl.textContent = '0.00';
    if(referralCodeEl) referralCodeEl.textContent = 'N/A';
    if(historyListEl) historyListEl.innerHTML = ''; // Clear content
    if(referralListEl) referralListEl.innerHTML = ''; // Clear content
}

// --- User Profile and Dashboard Data ---
async function fetchUserProfile() {
    if (!currentAuthToken) return;
    const result = await apiRequest('/users/profile');
    if (result.success) {
        currentUserData = result.data;
        updateDashboardDisplay();
        updateDailyCheckInUI();
    } else {
        console.error('Failed to fetch user profile:', result.message);
        if (result.message && result.message.toLowerCase().includes('expired')) {
            handleLogout();
        }
    }
}

function updateDashboardDisplay() {
    if (!currentUserData) return;
    if(userNameEl) userNameEl.textContent = currentUserData.name || 'User';
    if(balanceEl) balanceEl.textContent = (currentUserData.balance || 0).toFixed(2);
    if(referralCodeEl) referralCodeEl.textContent = currentUserData.referralCode || 'N/A';
}

// --- Navigation and Section Display ---
function showSignupPage() {
    signupPage.classList.remove('hidden');
    loginPage.classList.add('hidden');
    dashboardPage.classList.add('hidden');
    closeMenuIfNeeded();
}
function showLoginPage() {
    signupPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    dashboardPage.classList.add('hidden');
    closeMenuIfNeeded();
}

function showDashboardSection(sectionId) {
    document.querySelectorAll('#dashboardContent .section').forEach(s => s.classList.add('hidden'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        switch (sectionId) {
            case 'home':
                if (currentUserData) updateDashboardDisplay(); else fetchUserProfile();
                updateDailyCheckInUI();
                break;
            case 'deposit':
                fetchAndDisplayPlatformDepositInfo();
                break;
            case 'plans':
                fetchAndDisplayInvestmentPlans();
                break;
            case 'history':
                fetchAndDisplayTransactionHistory();
                break;
            case 'referrals':
                fetchAndDisplayReferrals();
                break;
        }
    } else {
        console.warn(`Section with ID "${sectionId}" not found.`);
        document.getElementById('home').classList.remove('hidden');
        if (currentUserData) updateDashboardDisplay(); else fetchUserProfile();
        updateDailyCheckInUI();
    }
    closeMenuIfNeeded();
}

function toggleMenu() {
    if(menuNav) menuNav.classList.toggle('open');
}
function closeMenuIfNeeded() {
    if(menuNav && menuNav.classList.contains('open')) menuNav.classList.remove('open');
}

// --- Deposit Functions ---
async function fetchAndDisplayPlatformDepositInfo() {
    if (platformDepositInfoCache) {
        renderPlatformDepositInfo(platformDepositInfoCache);
        return;
    }
    const result = await apiRequest('/platform/deposit-info');
    if (result.success) {
        platformDepositInfoCache = result.data;
        renderPlatformDepositInfo(result.data);
    } else {
        if(platformDepositAccountsContainerEl) platformDepositAccountsContainerEl.textContent = 'Could not load deposit account details.';
    }
}

function renderPlatformDepositInfo(info) {
    if (!platformDepositAccountsContainerEl || !info) return;
    platformDepositAccountsContainerEl.innerHTML = ''; // Clear previous content

    function createAccountDetail(title, name, number, instructions) {
        const accountDiv = document.createElement('div');
        accountDiv.className = 'account-details';

        const titleEl = document.createElement('h4');
        titleEl.textContent = title;
        accountDiv.appendChild(titleEl);

        const nameP = document.createElement('p');
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = 'Account Name: ';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name || 'N/A';
        nameP.appendChild(nameStrong);
        nameP.appendChild(nameSpan);
        accountDiv.appendChild(nameP);

        const numberP = document.createElement('p');
        const numberStrong = document.createElement('strong');
        numberStrong.textContent = 'Account Number ';
        const numberSpan = document.createElement('span');
        numberSpan.textContent = number || 'N/A';
        numberP.appendChild(numberStrong);
        numberP.appendChild(numberSpan);
        accountDiv.appendChild(numberP);

        if (instructions) {
            const instrP = document.createElement('p');
            const instrEm = document.createElement('em');
            instrEm.textContent = instructions;
            instrP.appendChild(instrEm);
            accountDiv.appendChild(instrP);
        }
        return accountDiv;
    }

    if (info.easypaisa) {
        platformDepositAccountsContainerEl.appendChild(
            createAccountDetail('Easypaisa:', info.easypaisa.name, info.easypaisa.number, info.easypaisa.instructions)
        );
    }
    if (info.jazzcash) {
        const jcDetail = createAccountDetail('JazzCash:', info.jazzcash.name, info.jazzcash.number, info.jazzcash.instructions);
        if (info.easypaisa) jcDetail.classList.add('mt-1'); // Add margin if not the first
        platformDepositAccountsContainerEl.appendChild(jcDetail);
    }

    if (platformDepositAccountsContainerEl.childElementCount === 0) {
        platformDepositAccountsContainerEl.textContent = 'No deposit methods currently available.';
    }
}

async function handleDepositSubmit(event) {
    event.preventDefault();
    const formData = new FormData(depositForm);
    const amount = parseFloat(formData.get('amount'));
    const txId = formData.get('transactionId');
    const screenshotFile = formData.get('screenshot');

    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid positive deposit amount.");
    if (!txId || !txId.trim()) return alert("Transaction ID is required."); // Check truthiness and trim
    if (!screenshotFile || screenshotFile.size === 0) return alert("Please upload a payment screenshot.");
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
    if (!allowedTypes.includes(screenshotFile.type)) return alert("Invalid file type. Please upload a PNG, JPG, or GIF image.");
    const maxSizeInBytes = 5 * 1024 * 1024;
    if (screenshotFile.size > maxSizeInBytes) return alert(`File is too large. Maximum size is ${maxSizeInBytes / (1024 * 1024)}MB.`);

    const result = await apiRequest('/transactions/deposit', 'POST', formData);
    if (result.success) {
        alert(result.data.message || 'Deposit request submitted successfully and is pending approval.');
        depositForm.reset();
        fetchUserProfile();
        showDashboardSection('history');
    } else {
        alert(`Deposit failed: ${result.message}`);
    }
}

// --- Withdrawal Functions ---
async function handleWithdrawSubmit(event) {
    event.preventDefault();
    const formData = new FormData(withdrawForm);
    const data = Object.fromEntries(formData.entries());

    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid positive withdrawal amount.");
    if (!data.method) return alert("Please select a withdrawal method.");
    if (!data.accountNumber || !data.accountNumber.trim()) return alert("Please enter your account number.");

    const result = await apiRequest('/transactions/withdraw', 'POST', data);
    if (result.success) {
        alert(result.data.message || 'Withdrawal request submitted and is pending approval.');
        withdrawForm.reset();
        fetchUserProfile();
        showDashboardSection('history');
    } else {
        alert(`Withdrawal failed: ${result.message}`);
    }
}

// --- Investment Plan Functions ---
async function fetchAndDisplayInvestmentPlans() {
    if (investmentPlansCache.length > 0) {
        renderInvestmentPlans(investmentPlansCache);
        return;
    }
    const result = await apiRequest('/platform/plans');
    if (result.success && Array.isArray(result.data)) {
        investmentPlansCache = result.data;
        renderInvestmentPlans(result.data);
    } else {
        if(investmentPlansContainerEl) investmentPlansContainerEl.textContent = 'Could not load investment plans.';
    }
}

function renderInvestmentPlans(plans) {
    if (!investmentPlansContainerEl) return;
    investmentPlansContainerEl.innerHTML = ''; // Clear previous

    if (plans.length === 0) {
        investmentPlansContainerEl.textContent = 'No investment plans currently available.';
        return;
    }

    plans.forEach(plan => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';

        const titleH3 = document.createElement('h3');
        titleH3.textContent = plan.name || 'Unnamed Plan';
        cardDiv.appendChild(titleH3);

        function createDetailP(label, value) {
            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = label + ': ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode(value)); // Appending text node is safer
            return p;
        }

        cardDiv.appendChild(createDetailP('Invest', `${(plan.investmentAmount || 0).toFixed(2)} PKR`));
        cardDiv.appendChild(createDetailP('Daily Return', `${(plan.dailyReturn || 0).toFixed(2)} PKR`));
        cardDiv.appendChild(createDetailP('Duration', `${plan.durationDays || 0} Days`));

        if (plan.description) {
            const descP = document.createElement('p');
            const descEm = document.createElement('em');
            descEm.textContent = plan.description;
            descP.appendChild(descEm);
            cardDiv.appendChild(descP);
        }

        const investButton = document.createElement('button');
        investButton.type = 'button';
        investButton.className = 'invest-btn';
        investButton.textContent = `Invest ${(plan.investmentAmount || 0).toFixed(2)} PKR`;
        investButton.dataset.planId = plan.id || plan.name; // Use ID if available, fallback to name
        cardDiv.appendChild(investButton);

        investmentPlansContainerEl.appendChild(cardDiv);
    });
}

async function handleInvest(planIdFromButton) { // Renamed parameter for clarity
    console.log("--- handleInvest Initiated ---");
    console.log("1. planIdFromButton (from data attribute):", planIdFromButton, "- Type:", typeof planIdFromButton);

    if (planIdFromButton === undefined || planIdFromButton === null || planIdFromButton === "") {
        alert('Error: Plan ID is missing from the button. Cannot proceed.');
        console.error("Error: planIdFromButton is undefined, null, or empty.");
        return;
    }

    // Log the cache to see what we're searching in
    console.log("2. Current investmentPlansCache:", JSON.stringify(investmentPlansCache, null, 2));

    if (!investmentPlansCache || investmentPlansCache.length === 0) {
        alert('Error: Investment plans cache is not loaded. Please refresh the page.');
        console.error("Error: investmentPlansCache is empty or not initialized.");
        return;
    }

    // Find the plan in the client-side cache
    // data-* attributes are always strings, so compare planIdFromButton (string)
    // with p.id (which should be a number from backend, so convert to string for comparison)
    const plan = investmentPlansCache.find(p => {
        if (p.id !== undefined && p.id !== null) {
            return p.id.toString() === planIdFromButton.toString();
        }
        // Fallback to name if ID is somehow missing (though ID should be primary)
        // This fallback is less ideal as names might not be unique
        if (p.name) {
            console.warn(`Warning: Plan ID missing for plan named '${p.name}', attempting to match by name.`);
            return p.name === planIdFromButton;
        }
        return false;
    });

    console.log("3. Plan found in cache:", JSON.stringify(plan, null, 2));

    if (!plan) {
        alert('Selected plan not found in client cache. Please ensure the page is fully loaded and try refreshing if the issue persists.');
        console.error("Error: Plan not found in investmentPlansCache. planIdFromButton was:", planIdFromButton);
        // For deeper debugging, you could loop and log here:
        // investmentPlansCache.forEach(cachedPlan => {
        //     console.log(`Comparing buttonId '${planIdFromButton}' (string) with cachedPlan.id '${cachedPlan.id}' (type: ${typeof cachedPlan.id})`);
        // });
        return;
    }

    // Crucially, ensure the plan object we found has a numeric ID to send to the backend
    if (plan.id === undefined || plan.id === null || isNaN(parseInt(plan.id))) {
        alert('Error: The selected plan data is missing a valid numeric ID. Please refresh or contact support.');
        console.error("Error: The 'plan' object found in cache is missing a valid numeric 'id' property:", plan);
        return;
    }

    const numericPlanIdToSend = parseInt(plan.id); // This is what the backend API expects

    if (!confirm(`Are you sure you want to invest ${plan.investmentAmount} PKR in the "${plan.name}"?`)) {
        console.log("User cancelled investment.");
        return;
    }

    console.log("4. Proceeding to API call. Sending numericPlanIdToSend:", numericPlanIdToSend);

    const result = await apiRequest('/transactions/invest', 'POST', { planId: numericPlanIdToSend });

    console.log("5. API response for investment:", result);

    if (result.success) {
        alert(result.data.message || `Successfully invested in ${plan.name}!`);
        fetchUserProfile(); // Refresh user data (balance, active plan)
        showDashboardSection('home'); // Or 'history'
    } else {
        alert(`Investment failed: ${result.message}`);
    }
    console.log("--- handleInvest Finished ---");
}

// --- Transaction History ---
async function fetchAndDisplayTransactionHistory() {
    if (!historyListEl) return;
    historyListEl.textContent = 'Loading transaction history...'; // Use textContent for loading message
    const result = await apiRequest('/transactions/history');
    if (result.success && Array.isArray(result.data)) {
        renderTransactionHistory(result.data);
    } else {
        historyListEl.textContent = 'Could not load transaction history.'; // Use textContent
        if(noHistoryMessageEl) noHistoryMessageEl.classList.remove('hidden');
    }
}

function renderTransactionHistory(transactions) {
    if (!historyListEl) return;
    historyListEl.innerHTML = ''; // Clear previous

    if (transactions.length === 0) {
        if(noHistoryMessageEl) noHistoryMessageEl.classList.remove('hidden');
        return;
    }
    if(noHistoryMessageEl) noHistoryMessageEl.classList.add('hidden');

    transactions.forEach(tx => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'transaction-item';

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'transaction-details';

        let typeClass = `transaction-type-${tx.type.toLowerCase().replace(/ /g, '-')}`;
        const typeSpan = document.createElement('span');
        typeSpan.className = typeClass;
        typeSpan.textContent = tx.type || 'Unknown Type';
        detailsDiv.appendChild(typeSpan);

        const statusSpan = document.createElement('span');
        const statusNormalized = (tx.status || 'completed').toLowerCase();
        statusSpan.className = `transaction-status status-${statusNormalized}`;
        statusSpan.textContent = tx.status || 'Completed';
        detailsDiv.appendChild(statusSpan);
        
        detailsDiv.appendChild(document.createTextNode(` \u00A0-\u00A0 `)); // Non-breaking space, hyphen, non-breaking space

        const descSpan = document.createElement('span');
        descSpan.textContent = tx.description || 'No details';
        detailsDiv.appendChild(descSpan);


        const dateSpan = document.createElement('span');
        dateSpan.className = 'transaction-date';
        try {
            dateSpan.textContent = new Date(tx.timestamp).toLocaleString();
        } catch (e) {
            dateSpan.textContent = 'Invalid Date';
        }
        detailsDiv.appendChild(dateSpan);
        itemDiv.appendChild(detailsDiv);

        const amount = parseFloat(tx.amount) || 0;
        let amountPrefix = '';
        if (['Deposit', 'Referral Bonus', 'Daily Earnings'].includes(tx.type) || (tx.type === 'Admin Adjustment' && amount >= 0)) {
            amountPrefix = '+';
            if (tx.type === 'Admin Adjustment') typeClass += ' positive'; else typeClass = typeClass.replace(' negative','');
        } else if (['Withdrawal', 'Investment'].includes(tx.type) || (tx.type === 'Admin Adjustment' && amount < 0)) {
            amountPrefix = '-';
            if (tx.type === 'Admin Adjustment') typeClass += ' negative'; else typeClass = typeClass.replace(' positive','');
        }
        
        const amountSpan = document.createElement('span');
        amountSpan.className = `transaction-amount ${typeClass}`; // Re-apply typeClass with positive/negative if needed
        amountSpan.textContent = `${amountPrefix}${Math.abs(amount).toFixed(2)} PKR`;
        itemDiv.appendChild(amountSpan);

        historyListEl.appendChild(itemDiv);
    });
}

// --- Referrals ---
async function fetchAndDisplayReferrals() {
    if (!referralListEl) return;
    referralListEl.textContent = 'Loading your referrals...'; // Use textContent
    const result = await apiRequest('/users/referrals');
    if (result.success && Array.isArray(result.data)) {
        renderReferrals(result.data);
    } else {
        referralListEl.textContent = 'Could not load referrals.'; // Use textContent
        if(noReferralsMessageEl) noReferralsMessageEl.classList.remove('hidden');
    }
}

function renderReferrals(referrals) {
    if (!referralListEl) return;
    referralListEl.innerHTML = ''; // Clear previous

    if (referrals.length === 0) {
        if(noReferralsMessageEl) noReferralsMessageEl.classList.remove('hidden');
        return;
    }
    if(noReferralsMessageEl) noReferralsMessageEl.classList.add('hidden');

    referrals.forEach(ref => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'referral-item';

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'referral-details';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'referral-name';
        nameSpan.textContent = ref.name || 'N/A';
        detailsDiv.appendChild(nameSpan);

        if (ref.email) {
            const emailSpan = document.createElement('span');
            emailSpan.className = 'referral-email';
            emailSpan.textContent = ` (${ref.email})`;
            detailsDiv.appendChild(emailSpan);
        }
        // Add more details like signupDate if backend provides, using textContent
        itemDiv.appendChild(detailsDiv);
        referralListEl.appendChild(itemDiv);
    });
}

// --- Change Password ---
async function handleChangePassword(event) {
    event.preventDefault();
    const formData = new FormData(changePasswordForm);
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmNewPassword = formData.get('confirmNewPassword');

    if (newPassword !== confirmNewPassword) {
        alert("New password and confirmation password do not match.");
        return;
    }
    if (newPassword.length < 6) {
        alert("New password must be at least 6 characters long.");
        return;
    }

    const result = await apiRequest('/users/change-password', 'POST', { currentPassword, newPassword });
    if (result.success) {
        alert(result.data.message || 'Password changed successfully!');
        changePasswordForm.reset();
        showDashboardSection('home');
    } else {
        alert(`Password change failed: ${result.message}`);
    }
}

// --- Daily Check-in ---
async function updateDailyCheckInUI() {
    if (!dailyCheckInSectionEl || !currentUserData) return;

    const statusText = checkInStatusTextEl;
    const checkInButton = dailyCheckInButtonEl;
    const nextCheckInEl = nextCheckInTimeEl;

    if (!checkInButton || !statusText || !nextCheckInEl) return;

    nextCheckInEl.classList.add('hidden');
    statusText.textContent = "Loading check-in status..."; // Use textContent

    const result = await apiRequest('/users/check-in-status');
    if (!result.success) {
        statusText.textContent = "Could not load check-in status.";
        checkInButton.disabled = true;
        return;
    }

    const checkInInfo = result.data;
    statusText.textContent = checkInInfo.message || "Check your status.";
    checkInButton.disabled = !checkInInfo.canCheckIn;

    if (checkInInfo.canCheckIn && typeof checkInInfo.dailyProfit === 'number') {
        checkInButton.textContent = `Claim ${checkInInfo.dailyProfit.toFixed(2)} PKR`;
    } else if (!checkInInfo.canCheckIn && checkInInfo.nextCheckInAt) {
        checkInButton.textContent = "Claimed Today";
        try {
            const nextTime = new Date(checkInInfo.nextCheckInAt).toLocaleString();
            nextCheckInEl.textContent = `Next check-in available after: ${nextTime}.`;
            nextCheckInEl.classList.remove('hidden');
        } catch(e) { console.warn("Invalid nextCheckInAt date", checkInInfo.nextCheckInAt); }
    } else if (checkInInfo.hasActivePlan === false) { // Explicitly check for false
        checkInButton.textContent = "View Plans";
        checkInButton.onclick = () => showDashboardSection('plans');
    } else {
        checkInButton.textContent = "Claim Daily Earnings";
    }
    if (checkInButton.textContent !== "View Plans") {
        checkInButton.onclick = performDailyCheckIn; // Restore default if changed
    }
}

async function performDailyCheckIn() {
    if(dailyCheckInButtonEl) dailyCheckInButtonEl.disabled = true;
    const result = await apiRequest('/users/check-in', 'POST');
    if (result.success) {
        alert(result.data.message || 'Daily check-in successful!');
        await fetchUserProfile();
        updateDailyCheckInUI();
    } else {
        alert(`Check-in failed: ${result.message}`);
        if(dailyCheckInButtonEl) dailyCheckInButtonEl.disabled = false; // Potentially re-enable based on new status
        updateDailyCheckInUI();
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    if(signupForm) signupForm.addEventListener('submit', handleSignup);
    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    if(showLoginBtn) showLoginBtn.addEventListener('click', showLoginPage);
    if(showSignupBtn) showSignupBtn.addEventListener('click', showSignupPage);

    if(menuToggleBtn) menuToggleBtn.addEventListener('click', toggleMenu);
    if(closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
    if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    if(menuNav) {
        menuNav.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON' && event.target.dataset.section) {
                showDashboardSection(event.target.dataset.section);
            }
        });
    }
    const viewPlansBtn = document.querySelector('button[data-section-target="plans"]');
    if (viewPlansBtn) {
        viewPlansBtn.addEventListener('click', () => {
            showDashboardSection('plans');
        });
    }

    if(depositForm) depositForm.addEventListener('submit', handleDepositSubmit);
    if(withdrawForm) withdrawForm.addEventListener('submit', handleWithdrawSubmit);
    if(changePasswordForm) changePasswordForm.addEventListener('submit', handleChangePassword);

    if(dailyCheckInButtonEl) dailyCheckInButtonEl.addEventListener('click', performDailyCheckIn); // Default listener

    if(investmentPlansContainerEl) {
        investmentPlansContainerEl.addEventListener('click', (event) => {
            if (event.target.classList.contains('invest-btn')) {
                const planId = event.target.dataset.planId;
                handleInvest(planId);
            }
        });
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    signupPage = document.getElementById('signupPage');
    loginPage = document.getElementById('loginPage');
    dashboardPage = document.getElementById('dashboard');
    signupForm = document.getElementById('signupForm');
    loginForm = document.getElementById('loginForm');
    showLoginBtn = document.getElementById('showLoginBtn');
    showSignupBtn = document.getElementById('showSignupBtn');
    menuToggleBtn = document.getElementById('menuToggleBtn');
    closeMenuBtn = document.getElementById('closeMenuBtn');
    logoutBtn = document.getElementById('logoutBtn');
    menuNav = document.getElementById('menu');
    userNameEl = document.getElementById('userName');
    balanceEl = document.getElementById('balance');
    referralCodeEl = document.getElementById('referralCode');
    depositForm = document.getElementById('depositForm');
    withdrawForm = document.getElementById('withdrawForm');
    changePasswordForm = document.getElementById('changePasswordForm');
    dailyCheckInSectionEl = document.getElementById('dailyCheckInSection');
    checkInStatusTextEl = document.getElementById('checkInStatusText');
    dailyCheckInButtonEl = document.getElementById('dailyCheckInButton');
    nextCheckInTimeEl = document.getElementById('nextCheckInTime');
    platformDepositAccountsContainerEl = document.getElementById('platformDepositAccountsContainer');
    investmentPlansContainerEl = document.getElementById('investmentPlansContainer');
    historyListEl = document.getElementById('historyList');
    noHistoryMessageEl = document.getElementById('noHistoryMessage');
    referralListEl = document.getElementById('referralList');
    noReferralsMessageEl = document.getElementById('noReferralsMessage');

    setupEventListeners();

    if (currentAuthToken) {
        updateUIVisibility(true);
        fetchUserProfile().then(() => {
            showDashboardSection('home');
        });
    } else {
        updateUIVisibility(false);
        showSignupPage();
    }
});