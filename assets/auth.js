// Read cached authentication data from local storage
let demoAuth = JSON.parse(localStorage.getItem("SE-Demo-" + userId));

// Set defaults if local storage doesn't exist yet
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
            // Avoid false alerts when running consent flow
            if (!currentUrl.includes("consent.html")) { 
                alert(text);
            }
        })
    }
    let responseData = await response.json();

    // Update local storage with returned token and expiration
    demoAuth.accessToken = responseData.access_token
    demoAuth.expiration = Date.now() + 1000 * 60 * 50; // 50 minutes from now 
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
    if (submitButton) { submitButton.disabled = false }; // condition check to avoid null errors
}

// Open login URL to get application consent
async function getConsent() {
    let returnUrl = new URL("index.html", currentUrl).href;
    let authParams = new URLSearchParams({
        response_type: "code",
        scope: scopes,
        client_id: "2f7ff6b0-e9ac-47cc-b555-2e102fd22254", // Do not change
        state: returnUrl,
        redirect_uri: "https://sign.agreementsdemo.com/Home/Redirect" // Do not change
    })
    let codeUrl = authUrl + "auth" + "?" + authParams;

    window.top.location.replace(codeUrl);
}