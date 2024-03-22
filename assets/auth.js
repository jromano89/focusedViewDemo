// Read cached authentication data from local storage
let demoAuth = JSON.parse(localStorage.getItem("SE-Demo-" + userId));

// Write defaults if local storage doesn't exist yet
if (!demoAuth) {
    demoAuth = {
        accessToken: "",
        expiration: ""
    }
    window.localStorage.setItem("SE-Demo-" + userId, JSON.stringify(demoAuth));
}

// Check if a new access token is needed
if (!demoAuth.accessToken || demoAuth.expiration < currentTime) {
    // Get a new access token, then update the request header
    getAccessToken(demoAuth.authCode).then(token => buildHeader(token));
} else {
    // Update request header with existing access token
    buildHeader(demoAuth.accessToken);
}

// Use middleware service to get new access token
async function getAccessToken() {

    // Middleware requires UserId and requested scopes as inputs
    let inputs = new URLSearchParams({
        userId: userId,
        scopes: scopes
    })
    let middlewareUrl = "https://sign.agreementsdemo.com/Envelope/getToken?" + inputs;

    let response = await fetch(middlewareUrl);

    if (!response.ok) {
        return response.text().then(text => {
            console.log(text);
            getConsent(); // Get consent if there's an error
        })
    }
    let responseData = await response.json();

    // Update local storage with returned token and expiration
    demoAuth.accessToken = responseData.access_token
    demoAuth.expiration = Date.now() + 1000 * 60 * 45; // 45 minutes from now 
    window.localStorage.setItem("SE-Demo-" + userId, JSON.stringify(demoAuth));

    return responseData.access_token;
}

function buildHeader(token) {
    // Create header with access token, to be used in all API requests
    requestHeader = new Headers({
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
    })
    // Enable submit button now that initialization is complete
    let submitButton = document.getElementById("submitButton");
    if (submitButton) { submitButton.disabled = false }; // Condition check to avoid null errors
}

// Open login URL to get application consent
async function getConsent() {
    let returnUrl = new URL("index.html", currentUrl).href;
    let authParams = new URLSearchParams({
        response_type: "code",
        scope: scopes,
        client_id: "2f7ff6b0-e9ac-47cc-b555-2e102fd22254", // Middleware uses this i-key
        state: returnUrl, // Actual redirect goes here, and is read by the service below
        redirect_uri: "https://sign.agreementsdemo.com/Home/Redirect" // This redirect service is added to the i-key
    })
    let codeUrl = authUrl + "auth" + "?" + authParams;

    window.top.location.assign(codeUrl);
}