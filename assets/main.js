/*  DocuSign Account Setup & Demo Config */
const accountId = "23202817";
const userId = "f1d4d61f-3c3b-4087-b00d-a6e60bf01855";
const scopes = "signature impersonation"; // https://developers.docusign.com/platform/auth/reference/scopes

// API endpoints
const baseUrl = "https://demo.docusign.net/restapi/v2.1/accounts/";
const authUrl = "https://account-d.docusign.com/oauth/";

// Proxy server that adds CORS headers to any request
const gateway = "https://cors.jerrod.workers.dev?"; // Append actual endpoint after the ?

// Initialize global variables
const urlParams = new URLSearchParams(window.location.search); // Used to read URL parameters
const currentUrl = window.location.href;
const currentTime = Date.now();
let requestHeader, docusignJS;

// Triggered when submit button is clicked
function submitForm(evt) {
    document.getElementById("submitButton").disabled = true; // Prevent multiple clicks
    document.getElementById("spinner").classList.remove("d-none"); // Start loading spinner
    let embedded = !document.getElementById("remote").checked;
    createEnvelope(embedded);
    return false; // Prevent default html form submission
}

// API call for creating a DocuSign envelope
async function createEnvelope(embedded) {

    // If c2a is checked, use a template without any signature tags
    let c2a = document.getElementById("c2a").checked;
    var templateId = (c2a) ? "6492da53-2958-411f-a863-9737ec86e514" : "b496c58e-8fa4-44be-9948-b7323270624e";

    // If supp doc is checked, read document file and convert to base64
    let supp = document.getElementById("supp").checked;
    if (supp) {
        let docPath = "assets/suppdoc.docx";
        var suppDoc = await fileToBase64(docPath);
        suppDoc = suppDoc.split(',')[1]; // Remove object type to get just the base64 string
    }

    let requestBody =
    {
        emailSubject: "Please sign your Agreement",
        compositeTemplates: [
            {
                serverTemplates: [
                    {
                        sequence: "1",
                        templateId: templateId
                    }
                ],
                inlineTemplates: [
                    {
                        sequence: "1",
                        recipients: {
                            signers: [
                                {
                                    roleName: "Signer",
                                    email: document.getElementById("email").value,
                                    name: document.getElementById("name").value,
                                    recipientId: "1",
                                    tabs: {
                                        textTabs: [
                                            {
                                                tabLabel: "address",
                                                value: document.getElementById("input1").value
                                            }, {
                                                tabLabel: "amount",
                                                value: document.getElementById("input2").value,
                                            }
                                        ]
                                    },
                                    // Specify a clientUserId if embedded signing flag is true
                                    ...(embedded && { clientUserId: document.getElementById("email").value })
                                }
                            ]
                        }
                    }
                ]
            },
            {
                // Add separate composite template if supp doc is needed
                ...(supp && {
                    document: {
                        documentId: "2",
                        name: "Supplemental Doc",
                        fileExtension: "docx",
                        display: "modal",
                        documentBase64: suppDoc,
                    }
                }),
                // An empty inlineTemplate object is required for the additional composite template
                inlineTemplates: [
                    {
                        sequence: "1"
                    }
                ]
            }
        ],
        useDisclosure: document.getElementById("ersd").checked, // Override ERSD account default
        status: "sent" // Setting status to "sent" will create and send envelope in one step
    }

    fetch(
        // Create Envelope Endpoint
        gateway + baseUrl + accountId + "/envelopes",
        {
            method: "POST",
            headers: requestHeader,
            body: JSON.stringify(requestBody)
        }
    )
        .then(function (response) {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) })
            } else
                return response.json();
        })
        // Trigger next function for embedded, or redirect to status page for remote
        .then(function (data) {

            localStorage.setItem("SE-Demo-EnvelopeId", data.envelopeId);
            localStorage.setItem("SE-Demo-RecipientName", document.getElementById("name").value);
            localStorage.setItem("SE-Demo-RecipientEmail", document.getElementById("email").value);

            if (embedded) {
                createEmbeddedUrl(data);
            } else {
                let redirectUrl = new URL("status.html", currentUrl).href;
                window.top.location.assign(redirectUrl + "?eid=" + data.envelopeId + "&event=" + data.status);
            }
        })
        .catch(function (error) {
            alert(error);
        });
}

// API call for generating embedded signing view
async function createEmbeddedUrl(responseData) {
    let returnUrl = new URL("redirect.html", currentUrl).href; // Used to break out of iframe

    let requestBody = {
        userName: document.getElementById("name").value, // Must match the previous request
        email: document.getElementById("email").value,
        roleName: "Signer",
        clientUserId: document.getElementById("email").value,
        authenticationMethod: "SingleSignOn_SAML", // Purely for Certificate of Completion
        returnUrl: returnUrl + "?eid=" + responseData.envelopeId,
        frameAncestors: ["https://jromano89.github.io", "https://dsdemos.esigndemos.com", "http://127.0.0.1:5500", "https://apps-d.docusign.com"],
        messageOrigins: ["https://apps-d.docusign.com"] // Required for focused view
    }
    let response = await fetch(
        // Create Recipient View Endpoint
        gateway + baseUrl + accountId + "/envelopes/" + responseData.envelopeId + "/views" + "/recipient",
        {
            method: "POST",
            headers: requestHeader,
            body: JSON.stringify(requestBody)
        }
    )
        .then(function (response) {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) })
            } else
                return response.json();
        })
        // Load iframe or focused view with embedded signing URL
        .then(function (data) {
            if (document.getElementById("focused").checked) {
                localStorage.setItem("SE-Demo-SigningUrl", data.url); // Use local storage to store signing URL
                localStorage.setItem("SE-Demo-UrlState", "ready");
                let redirectUrl = new URL("embed.html", currentUrl).href;
                window.top.location.assign(redirectUrl + "?c2a=" + document.getElementById("c2a").checked);
            } else {
                document.getElementById("myFrame").setAttribute("src", data.url);
                let signingSession = new bootstrap.Modal(document.getElementById('signModal'));
                document.getElementById("submitButton").disabled = false;
                document.getElementById("spinner").classList.add("d-none");
                signingSession.show();
            }
        })
        .catch(function (error) {
            alert(error);
        });
}

async function refreshEmbeddedUrl(envelopeId, recipientName, recipientEmail) {

    let requestBody = {
        userName: recipientName,
        email: recipientEmail,
        roleName: "Signer",
        clientUserId: recipientEmail,
        authenticationMethod: "SingleSignOn_SAML", // Purely for Certificate of Completion
        returnUrl: new URL("redirect.html", currentUrl).href + "?eid=" + envelopeId,
        frameAncestors: ["https://jromano89.github.io", "https://dsdemos.esigndemos.com", "http://127.0.0.1:5500", "https://apps-d.docusign.com"],
        messageOrigins: ["https://apps-d.docusign.com"] // Required for focused view
    }
    let response = await fetch(
        // Create Recipient View Endpoint
        gateway + baseUrl + accountId + "/envelopes/" + envelopeId + "/views" + "/recipient",
        {
            method: "POST",
            headers: requestHeader,
            body: JSON.stringify(requestBody)
        }
    )

    if (!response.ok) {
        return response.text().then(text => { throw new Error(text) })
    }

    let responseData = await response.json();

    localStorage.setItem("SE-Demo-SigningUrl", responseData.url); 
    localStorage.setItem("SE-Demo-UrlState", "ready");
    return responseData.url;
}

// Update UI based on options selected
function deliveryHandler(evt) {

    let c2a = document.getElementById("c2a");

    if (evt == "focused") {
        document.getElementById('submitText').innerHTML = "Sign Now";
        c2a.disabled = false;
    } else if (evt == "embedded") {
        document.getElementById('submitText').innerHTML = "Sign Now";
        c2a.checked = false;
        c2a.disabled = true;
    } else if (evt == "remote") {
        document.getElementById('submitText').innerHTML = "Send Agreement for eSignature";
        c2a.checked = false;
        c2a.disabled = true;
    }


}

// Make API call to retrieve document or CoC
function getPDF() {
    const envId = urlParams.get("eid");
    let docType = document.getElementById("docType").value;
    fetch(
        gateway + baseUrl + accountId + "/envelopes/" + envId + "/documents/" + docType,
        {
            method: "GET",
            headers: requestHeader,
        }
    )
        .then(res => res.blob())
        .then(blob => {
            let file = window.URL.createObjectURL(blob);
            document.getElementById("myFrame").setAttribute("src", file);
            let docModal = new bootstrap.Modal(document.getElementById('docModal'));
            docModal.show();
        });
}

// Make API call to get envelope events
function getStatus() {
    const envId = urlParams.get("eid");
    fetch(
        gateway + baseUrl + accountId + "/envelopes/" + envId + "/audit_events",
        {
            method: "GET",
            headers: requestHeader,
        }
    )
        .then(function (response) {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) })
            } else
                return response.json();
        })
        .then(function (data) {
            createTable(data.auditEvents);
        })
        .catch(function (error) {
            alert(error);
        });
}

// Create a table based on envelope events
function createTable(events) {

    let tableRef = document.getElementById('myTable').getElementsByTagName('tbody')[0];

    // Clear existing rows
    while (tableRef.rows.length > 0) {
        tableRef.deleteRow(0);
    }

    // Loop through events passed to function
    for (let i = 0; i < events.length; i++) {
        // Get relevant eventFields
        let logTime = events[i].eventFields.find(obj => obj.name == 'logTime').value;
        let UserName = events[i].eventFields.find(obj => obj.name == 'UserName').value;
        let Action = events[i].eventFields.find(obj => obj.name == 'Action').value;
        let EnvelopeStatus = events[i].eventFields.find(obj => obj.name == 'EnvelopeStatus').value;

        // Create new table row
        let row = tableRef.insertRow();
        row.insertCell().innerHTML = i + 1;
        row.insertCell().innerHTML = logTime.slice(0, -9); // Trim milliseconds
        row.insertCell().innerHTML = UserName;
        row.insertCell().innerHTML = Action;
        row.insertCell().innerHTML = EnvelopeStatus;
    }

    let eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
    eventModal.show();
}

// Handle iframe redirect to update the parent window
function redirect() {
    const envId = urlParams.get("eid");
    const signerEvent = urlParams.get("event");
    let redirectUrl = new URL("status.html", currentUrl).href;
    window.top.location.replace(redirectUrl + "?eid=" + envId + "&event=" + signerEvent);
}

// Load initial screen
function restartDemo() {
    const startUrl = new URL("index.html", currentUrl).href;
    window.top.location.assign(startUrl);
}

// Initialize status page using URL parameters
function loadStatusPage() {
    const envId = urlParams.get("eid");
    const signerEvent = urlParams.get("event");
    document.getElementById("envId").innerHTML = envId;
    document.getElementById("envStatus").innerHTML = signerEvent;
}

// Convert local file to base64
async function fileToBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((onSuccess, onError) => {
        try {
            const reader = new FileReader();
            reader.onload = function () { onSuccess(this.result) };
            reader.readAsDataURL(blob);
        } catch (e) {
            onError(e);
        }
    });
};

// Initialize DocuSign.js
function initDocuSignJS() {
    const apiKey = "2f7ff6b0-e9ac-47cc-b555-2e102fd22254";

    window.DocuSign.loadDocuSign(apiKey)
        .then((result) => {
            docusignJS = result;
            initFocusedView();
        })
        .catch(function (error) {
            alert(error);
        });
}

// Load signing URL using DocuSign.js
async function initFocusedView() {

    let finishText = (urlParams.get("c2a") == 'true') ? "Agree" : "Finish";
    let signingUrl = localStorage.getItem("SE-Demo-SigningUrl");
    let urlState = localStorage.getItem("SE-Demo-UrlState");

    if (urlState == "expired") {

        let envelopeId = localStorage.getItem("SE-Demo-EnvelopeId");
        let recipientName = localStorage.getItem("SE-Demo-RecipientName");
        let recipientEmail = localStorage.getItem("SE-Demo-RecipientEmail");

        signingUrl = await refreshEmbeddedUrl(envelopeId, recipientName, recipientEmail);
    }

    const signing = docusignJS.signing({
        url: signingUrl,
        displayFormat: 'focused',
        style: {
            branding: {
                primaryButton: {
                    backgroundColor: '#198754',
                    color: '#FFF',
                }
            },
            signingNavigationButton: {
                finishText: finishText
            }
        }
    });

    signing.on('ready', (event) => { });

    signing.on('sessionEnd', (event) => {
        window.top.location.assign(event.returnUrl);
    });

    signing.mount('#agreement');

    localStorage.setItem("SE-Demo-UrlState", "expired");

}

// You made it to the end!