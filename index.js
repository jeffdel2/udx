const purchases = [
	{
		date: new Date(),
		description: 'Purchase from Pencils paid via Okta Bank',
		value: 102,
	},
	{
		date: new Date(),
		description: 'Purchase from Pencils paid via Okta Bank',
		value: 42,
	},
]

async function updateProfileWithMFA() {
  try {
    // Step 1: Trigger MFA challenge
    const mfaResponse = await fetch('/trigger-mfa', { method: 'POST' });
    if (!mfaResponse.ok) throw new Error('MFA challenge failed.');

    // Step 2: Submit the profile form
    document.getElementById('profileForm').submit();
  } catch (error) {
    alert('MFA is required to update your profile.');
    console.error('MFA Error:', error);
  }
}

/*
const {
	ISSUER_BASE_URL,
	CLIENT_ID,
	CLIENT_SECRET,
  MGMT_CLIENT_ID,
	MGMT_CLIENT_SECRET,
	AUDIENCE,
	SCOPE,
	RESPONSE_TYPE,
	SESSION_SECRET,
	APP_URL,
	BANK_ISSUER,
	BANK_CLIENT_ID,
	BANK_AUDIENCE,
	BANK_AUD_SCOPES,
	BANK_REDIRECT_URI,
} = process.env
*/

const PORT = process.env.PORT || 8080

require('dotenv').config();
const express = require('express')
const cors = require('cors')({ origin: true })
const morgan = require('morgan')
const logger = require('./winston')
const axios = require('axios')
const bodyParser = require('body-parser')
// const slideout = require('./public/js/slideout.js')

// add-ons for the front end
const session = require('express-session')
const createError = require('http-errors')
const cookieParser = require('cookie-parser')
const path = require('path')
const { auth, requiresAuth } = require('express-openid-connect')
const { Issuer } = require('openid-client')
const { JWK } = require('node-jose')
const { OktaFGAIntegration, createAuthMiddleware } = require('./fga-integration')

//var privateKey = process.env.PVT_KEY.replace(/\\n/g, "\n")
var keystore = JWK.createKeyStore()
var auth0Issuer
var client

async function getManagementApiToken() {
  try {
    const response = await axios.post(`https://nbcu.cic-demo-platform.auth0app.com/oauth/token`, {
      client_id: process.env.MGMT_CLIENT_ID,
      client_secret: process.env.MGMT_CLIENT_SECRET,
      audience: `https://nbcu.cic-demo-platform.auth0app.com/api/v2/`,
      grant_type: 'client_credentials',
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Standalone error minting Management API token:', error.message);
    throw error;
  }
}

const responseType = 'code'
const responseTypesWithToken = ['code id_token', 'code']

const authConfig = {
	secret: process.env.SESSION_SECRET,
	authRequired: false,
	auth0Logout: true,
	baseURL: process.env.APP_URL,
	issuerBaseURL: process.env.ISSUER_BASE_URL,
	clientID: process.env.CLIENT_ID,
	clientSecret: process.env.CLIENT_SECRET,
	authorizationParams: {
		response_type: process.env.RESPONSE_TYPE,
		audience: process.env.AUDIENCE,
		scope: process.env.SCOPE,
	},
}


//add-ons for header based authN
const { header, validationResult } = require('express-validator');

const attributes = [
    {"id":"user_email","description":"User email"},
    {"id":"okta_user","description":"Username"},
    {"id":"first_name","description":"First Name"},
    {"id":"last_name","description":"Last Name"},
    {"id":"ldap_category","description":"Category"},
    {"id":"ldap_address","description":"Address"},
    {"id":"device","description":"Device State"},
    {"id":"amr","description":"Authentication Context"},
    {"id":"groups","description":"User groups separated by collon (:), typically taken from the LDAP or AD"},
    {"id":"host","description":"Application Host"},
  ];

const app = express()
app.use(cors)

// new stuff for the front end
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')
app.use('/static', express.static('public'))
app.use(auth(authConfig))

// Initialize FGA integration
const fgaIntegration = new OktaFGAIntegration();
const fgaAuthMiddleware = createAuthMiddleware(fgaIntegration);

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: true,
	})
)

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(
	morgan('":method :url :status :res[content-length] - :response-time ms"', {
		stream: logger.stream,
	})
)

app.get('/', async (req, res, next) => {
	try {
		res.render('landing', {
			user: req.oidc && req.oidc.user,
		})
	} catch (err) {
		console.log(err)
		next(err)
	}
})

/*
app.get('/access', async (req, res) => {
  console.log("ACCESS ERROR", req)
  res.render('access', {
	  user: req.oidc && req.oidc.user,
    access: req.oidc.user.access_granted,
	})
})
*/

app.get('/user', requiresAuth(), async (req, res) => {
	res.render('user', {
		user: req.oidc && req.oidc.user,
		id_token: req.oidc && req.oidc.idToken,
		access_token: req.oidc && req.oidc.accessToken,
		refresh_token: req.oidc && req.oidc.refreshToken,
    first: req.oidc.user.first_name,
	})
})



app.get('/profile', requiresAuth(), async (req, res) => {
  try {
    const token = await getManagementApiToken()
    const userId = req.oidc.user.sub;
	const authz_header = { Authorization: `Bearer ${token}` };

	const url1 = `${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}`;
    const url2 = `${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}/authentication-methods`;

	console.log('Initiating API calls...');

    // Use Promise.all to make concurrent requests
    // axios.get() returns a promise
    const [response1, response2] = await Promise.all([
      axios.get(url1, { headers: authz_header }),
      axios.get(url2, { headers: authz_header })
    ]);

    console.log('Both API calls completed successfully!');

    // You can now access the data from each response
    res.locals.user = response1.data;
    res.locals.factors = response2.data;
    
	//const response = await axios.get(`${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}`, {
    //  headers: { Authorization: `Bearer ${token}` },
    //});
    //res.locals.user = response.data;
	

  } catch (error) {
    console.error('Error fetching data from one or more APIs:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request Error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error Message:', error.message);
    }
  }

  // Get user's ticket relationships from FGA
  let userTicketRelationships = [];
  let userPurchasedTickets = [];
  let userUsedTickets = [];
  
  try {
    userTicketRelationships = await fgaIntegration.getUserTicketRelationships(req.oidc.user.sub);
    console.log('User ticket relationships:', userTicketRelationships);
  } catch (error) {
    console.error('Error fetching ticket relationships:', error.message);
  }

  try {
    userPurchasedTickets = await fgaIntegration.getUserPurchasedTickets(req.oidc.user.sub);
    console.log('User purchased tickets:', userPurchasedTickets);
    
    // Parse the FGA response to extract GUIDs
    const parsedPurchasedTickets = userPurchasedTickets.map(ticketObject => {
      // Extract GUID from "tickets:GUID" format
      const guid = ticketObject.replace('tickets:', '');
      
      // Parse GUID format: type-timestamp-random
      const parts = guid.split('-');
      const typePrefix = parts[0];
      const timestamp = parts[1];
      
      // Map type prefixes to readable names
      const typeMap = {
        'adt': 'Adult Day Pass',
        'chd': 'Child Day Pass',
        'sen': 'Senior Day Pass',
        'fam': 'Family Pass',
        'day': 'Day Pass',
        'weekend': 'Weekend Pass',
        'season': 'Season Pass'
      };
      
      return {
        type: typeMap[typePrefix] || guid, // Human readable name
        guid: guid, // Full GUID
        object: ticketObject, // Full FGA object
        typePrefix: typePrefix, // Type prefix
        timestamp: timestamp, // Purchase timestamp
        purchaseDate: timestamp ? new Date(parseInt(timestamp)).toLocaleDateString() : 'Unknown'
      };
    });
    
    userPurchasedTickets = parsedPurchasedTickets;
  } catch (error) {
    console.error('Error fetching purchased tickets:', error.message);
  }

  try {
    userUsedTickets = await fgaIntegration.getTicketsByStatus(req.oidc.user.sub, 'used');
    console.log('User used tickets:', userUsedTickets);
  } catch (error) {
    console.error('Error fetching used tickets:', error.message);
  }
  const clientId = `${process.env.CLIENT_ID}`;
  const mgmtUrl = `${process.env.MGMT_BASE_URL}`;
  const issuerUrl = `${process.env.ISSUER_BASE_URL}`;
  const appUrl = `${process.env.APP_URL}`;

  res.render('profile2', { 
    user: res.locals.user,
	factors: res.locals.factors,
    userTicketRelationships: userTicketRelationships,
    userPurchasedTickets: userPurchasedTickets,
    userUsedTickets: userUsedTickets,
	clientId, 
	issuerUrl, 
	mgmtUrl, 
	appUrl
  });
});

// Handle profile updates
app.post('/profile', requiresAuth(), async (req, res) => {
  const userId = req.oidc.user.sub;
  const { name, given_name, family_name, email, first_name, last_name, consents } = req.body;
  const sanitizedConsents = Array.isArray(consents) ? consents.filter(Boolean) : [];

  try {
    const token = await getManagementApiToken()
    
    /* Step 1: Trigger MFA Challenge
    const mfaChallengeResponse = await axios.post(
      `${ISSUER_BASE_URL}/mfa/challenge`,
      {
        client_id: CLIENT_ID,
        user_id: userId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // The MFA challenge is sent; now await user confirmation.
    const mfaToken = mfaChallengeResponse.data.mfa_token;
    */
    
    // Fetch current user data
    const userResponse = await axios.get(`${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const currentMetadata = userResponse.data.user_metadata || {};
    
    // Merge existing metadata with new updates
    const updatedMetadata = {
      //...currentMetadata.consents,
      consents: sanitizedConsents || ""
    };
    
    // Merge existing core attributes with new updates
    const updatedGivenName = given_name || null;
    const updatedFamilyName = family_name || null;
    
    console.log('Payload to Auth0:', {
      user_metadata: { ...currentMetadata, consents: sanitizedConsents },
      email, given_name: updatedGivenName, family_name: updatedFamilyName,
      });
    
    // Update user metadata via Auth0 Management API
    await axios.patch(
      `${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}`,
      {
        user_metadata: updatedMetadata,
        email,// Optional: Update email in root profile (if allowed)
        name,
        given_name: updatedGivenName,
        family_name: updatedFamilyName
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating user data:', error.message);
    res.status(500).send('Error updating profile.');
  }
});

app.use(session({
  secret: 'funland-secret',
  resave: false,
  saveUninitialized: true
}));

const tickets = [
  { id: 'day', name: 'Day Pass', price: 49.99, description: 'Unlimited rides for one day' },
  { id: 'weekend', name: 'Weekend Pass', price: 89.99, description: 'All weekend access' },
  { id: 'season', name: 'Season Pass', price: 199.99, description: 'Visit all season' }
];

// Home page with tickets
app.get('/tickets', requiresAuth(), async (req, res) => {
  try {
    // Get all ticket relationships for the user (optional - for display purposes)
    let userTicketRelationships = [];
    try {
      userTicketRelationships = await fgaIntegration.getUserTicketRelationships(req.oidc.user.sub);
      console.log('User ticket relationships:', userTicketRelationships);
    } catch (error) {
      console.error('Error fetching ticket relationships (non-blocking):', error.message);
    }
    
    res.render('tickets', { 
      tickets,
      user: req.oidc && req.oidc.user,
      userTicketRelationships: userTicketRelationships
    });
  } catch (error) {
    console.error('Error rendering tickets page:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add to cart
app.post('/add-to-cart', requiresAuth(), async (req, res) => {
  try {
    const ticketId = req.body.ticketId;
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).send('Ticket not found.');

    req.session.cart = req.session.cart || [];
    req.session.cart.push(ticket);
    res.redirect('/checkout');
  } catch (error) {
    console.error('Error adding to cart:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from cart
app.post('/remove-from-cart', (req, res) => {
  const itemIndex = parseInt(req.body.itemIndex);
  
  if (req.session.cart && itemIndex >= 0 && itemIndex < req.session.cart.length) {
    req.session.cart.splice(itemIndex, 1);
  }
  
  res.redirect('/checkout');
});

// FGA Management Routes (for testing and administration)
app.post('/fga/grant-permission', requiresAuth(), async (req, res) => {
  try {
    const { userId, action, resource } = req.body;
    
    if (!userId || !action || !resource) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const success = await fgaIntegration.createRelationship(userId, action, resource);
    
    if (success) {
      res.json({ message: 'Permission granted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to grant permission' });
    }
  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/fga/remove-permission', requiresAuth(), async (req, res) => {
  try {
    const { userId, action, resource } = req.body;
    
    if (!userId || !action || !resource) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const success = await fgaIntegration.removeRelationship(userId, action, resource);
    
    if (success) {
      res.json({ message: 'Permission removed successfully' });
    } else {
      res.status(500).json({ error: 'Failed to remove permission' });
    }
  } catch (error) {
    console.error('Error removing permission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/fga/check-permission', requiresAuth(), async (req, res) => {
  try {
    const { userId, action, resource } = req.query;
    
    if (!userId || !action || !resource) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const isAuthorized = await fgaIntegration.checkAuthorization(userId, action, resource);
    
    res.json({ 
      userId, 
      action, 
      resource, 
      authorized: isAuthorized 
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/fga/user-relationships', requiresAuth(), async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    
    // Get all relationships for the current user
    const allRelationships = await fgaIntegration.getAllUserRelationships(userId);
    
    // Get ticket-specific relationships
    const ticketRelationships = await fgaIntegration.getUserTicketRelationships(userId);
    
    res.json({ 
      userId,
      allRelationships,
      ticketRelationships,
      totalRelationships: allRelationships.length,
      ticketRelationshipCount: ticketRelationships.length
    });
  } catch (error) {
    console.error('Error getting user relationships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ticket management routes
app.post('/tickets/claim', requiresAuth(), async (req, res) => {
  try {
    const { ticketObject } = req.body;
    const userId = req.oidc.user.sub;
    
    if (!ticketObject) {
      return res.status(400).json({ error: 'Ticket object is required' });
    }
    
    const success = await fgaIntegration.claimTicket(userId, ticketObject);
    
    if (success) {
      res.json({ message: 'Ticket claimed successfully' });
    } else {
      res.status(500).json({ error: 'Failed to claim ticket' });
    }
  } catch (error) {
    console.error('Error claiming ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/tickets/use', requiresAuth(), async (req, res) => {
  try {
    const { ticketObject } = req.body;
    const userId = req.oidc.user.sub;
    
    if (!ticketObject) {
      return res.status(400).json({ error: 'Ticket object is required' });
    }
    
    const success = await fgaIntegration.useTicket(userId, ticketObject);
    
    if (success) {
      res.json({ message: 'Ticket used successfully' });
    } else {
      res.status(500).json({ error: 'Failed to use ticket' });
    }
  } catch (error) {
    console.error('Error using ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/tickets/delete', requiresAuth(), async (req, res) => {
  try {
    const { ticketObject } = req.body;
    const userId = req.oidc.user.sub;
    
    if (!ticketObject) {
      return res.status(400).json({ error: 'Ticket object is required' });
    }
    
    const success = await fgaIntegration.deleteTicket(userId, ticketObject);
    
    if (success) {
      res.json({ message: 'Ticket deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/tickets/by-status/:status', requiresAuth(), async (req, res) => {
  try {
    const { status } = req.params;
    const userId = req.oidc.user.sub;
    
    const tickets = await fgaIntegration.getTicketsByStatus(userId, status);
    
    res.json({ 
      userId,
      status,
      tickets,
      count: tickets.length
    });
  } catch (error) {
    console.error('Error getting tickets by status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Checkout page
app.get('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, t) => sum + t.price, 0);
  res.render('checkout', { cart, total });
});

// Process payment (mock)
app.post('/process-payment', requiresAuth(), async (req, res) => {
  const { cardNumber, name, vendor, expiry } = req.body;
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, t) => sum + t.price, 0);

  // Mock validation
  if (!cardNumber || !name || !vendor || !expiry || cardNumber.length < 12) {
    return res.render('payment-failure', { reason: 'Invalid payment details' });
  }

  // Stubbed payment vendor logic
  const transactionId = 'MOCK-' + Math.floor(Math.random() * 1000000);

  try {
    // Create FGA tuples for each purchased ticket
    const userId = req.oidc.user.sub;
    const purchaseResults = [];

    for (const ticket of cart) {
      const result = await fgaIntegration.createTicketPurchase(
        userId, 
        ticket.id, 
        ticket.name, 
        transactionId
      );
      
      purchaseResults.push({
        ticketId: ticket.id,
        ticketName: ticket.name,
        success: result.success,
        ticketGuid: result.ticketGuid,
        object: result.object
      });
      
      console.log(`Purchase tuple creation for ${ticket.name}: ${result.success ? 'SUCCESS' : 'FAILED'}, GUID: ${result.ticketGuid}`);
    }

    // Log purchase results
    console.log('FGA Purchase Results:', purchaseResults);

    // Clear cart after "payment"
    req.session.cart = [];

    res.render('payment-success', {
      name,
      vendor,
      total,
      transactionId,
      purchaseResults
    });
  } catch (error) {
    console.error('Error processing payment and creating FGA tuples:', error.message);
    
    // Still clear cart and show success, but log the FGA error
    req.session.cart = [];
    
    res.render('payment-success', {
      name,
      vendor,
      total,
      transactionId,
      purchaseResults: [],
      fgaError: true
    });
  }
});


app.get('/dashboard', requiresAuth(), (req, res) => {
  res.render('dashboard', {
    isAdmin: req.userRoles.includes('admin'), // Check if user is an admin
    isUser: req.userRoles.includes('user'),  // Check if user is a non-admin
  });
});

app.get('/portal', requiresAuth(), async (req, res) => {
    try {
    const token = await getManagementApiToken()
    const userId = req.oidc.user.sub;
    const response = await axios.get(`${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.locals.user = response.data;
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.locals.user = req.oidc.user;
  }
  res.render('portal', { user: res.locals.user });
  console.log('Res sent to template:', res.locals.user);
});


app.post('/trigger-mfa', requiresAuth(), async (req, res) => {
  const userId = req.oidc.user.sub;

  try {
    const token = await getManagementApiToken();

    // Trigger MFA Challenge
    const response = await axios.post(
      `${process.env.ISSUER_BASE_URL}/mfa/challenge`,
      {
        client_id: process.env.CLIENT_ID,
        user_id: userId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    res.status(200).send('MFA challenge sent successfully.');
  } catch (error) {
    console.error('Error triggering MFA:', error.response?.data || error.message);
    res.status(500).send('Error triggering MFA.');
  }
});



app.get('/headers', async (req, res) => {
  console.log("REQUEST  ",req.headers.host)
	res.render('headers', {
		host: req.headers.host,
	})
})

app.get('/cart', requiresAuth(), async (req, res) => {
	let errorMessage
	const error = req.query && req.query.error
	if (error === 'access_denied') {
		// The AS said we are not allowed to do this transaction, tell the end-user!
		errorMessage =
			'You are not authorized to make this transaction. Perhaps you can try with a smaller transaction amount?'
		delete req.session.pendingTransaction
	}

	res.render('cart', {
		user: req.oidc && req.oidc.user,
		id_token: req.oidc && req.oidc.idToken,
		access_token: req.oidc && req.oidc.accessToken,
		refresh_token: req.oidc && req.oidc.refreshToken,
		errorMessage,
	})
})

app.get('/prepare-transaction', requiresAuth(), async (req, res) => {
	let errorMessage
	const error = req.query && req.query.error
	if (error === 'access_denied') {
		// The AS said we are not allowed to do this transaction, tell the end-user!
		errorMessage =
			'You are not authorized to make this transaction. Perhaps you can try with a smaller transaction amount?'
		delete req.session.pendingTransaction
	}

	const transaction_amount = (req.query && req.query.transaction_amount) || 15
	res.render('transaction', {
		user: req.oidc && req.oidc.user,
		id_token: req.oidc && req.oidc.idToken,
		access_token: req.oidc && req.oidc.accessToken,
		refresh_token: req.oidc && req.oidc.refreshToken,
		transaction_amount,
		errorMessage,
	})
})

app.get('/resume-transaction', requiresAuth(), async (req, res, next) => {
	const tokenSet = await client.callback(
		BANK_REDIRECT_URI,
		{ code: req.query.code },
		{ nonce: '132123' }
	)
	console.log(`Token set: ${tokenSet}`)

	if (req.session.pendingTransaction) {
		console.log(
			'Processing pending transaction',
			req.session.pendingTransaction
		)
		try {
			const { type, amount, from, to } = req.session.pendingTransaction
			// TODO: handle the error case here...
			submitTransaction({ type, amount, from, to }, req)
			res.redirect('/transaction-complete')
		} catch (err) {
			console.log('refused to connect')
			console.log(err.stack)
			return next(err)
		}
	} else {
		const transaction_amount = (req.query && req.query.amount) || 15
		res.render('transaction', {
			user: req.oidc && req.oidc.user,
			id_token: req.oidc && req.oidc.idToken,
			access_token: req.oidc && req.oidc.accessToken,
			refresh_token: req.oidc && req.oidc.refreshToken,
			transaction_amount,
		})
	}
})

app.get('/transaction-complete', requiresAuth(), async (req, res) => {
	res.render('transaction-complete', {
		user: req.oidc && req.oidc.user,
	})
})

const submitTransaction = (payload, req) => {
	const type = payload.type
	const transferFrom = payload.from
	const transferTo = payload.to
	const amount = payload.amount

	purchases.push({
		date: new Date(),
		description: `${type} from ${transferTo} paid via ${transferFrom}`,
		value: amount,
	})

	delete req.session.pendingTransaction
}

app.post('/submit-transaction', requiresAuth(), async (req, res, next) => {
	const type = req.body.type
	const amount = Number(req.body.amount)
	const transferFrom = req.body.transferFrom
	const transferTo = req.body.transferTo
	try {
		if (responseTypesWithToken.includes(RESPONSE_TYPE)) {
			const authorization_details = [
				{
					type: type,
					amount: amount,
					from: transferFrom,
					to: transferTo,
				},
			]

			req.session.pendingTransaction = {
				type: type,
				amount: amount,
				from: transferFrom,
				to: transferTo,
			}

			const authorization_request = {
				audience: BANK_AUDIENCE,
				scope: `openid profile ${BANK_AUD_SCOPES}`,
				nonce: '132123',
				response_type: responseType,
				authorization_details: JSON.stringify(authorization_details),
			}
			console.log('authZ', authorization_request)

			const response = await client.pushedAuthorizationRequest(
				authorization_request
			)
			console.log('PAR response', response)

			res.redirect(
				`${BANK_ISSUER}/authorize?client_id=${process.env.BANK_CLIENT_ID}&request_uri=${response.request_uri}`
			)

			return
		} else {
			next(
				createError(
					403,
					'Access token required to complete this operation. Please, use an OIDC flow that issues an access_token'
				)
			)
		}
	} catch (err) {
		next(err)
	}
})

app.get('/balance', requiresAuth(), async (req, res, next) => {
	try {
		if (responseTypesWithToken.includes(RESPONSE_TYPE)) {
			let totalPurchases = purchases.reduce(
				(accum, purchase) => accum + purchase.value,
				0
			)

			res.render('balance', {
				user: req.oidc && req.oidc.user,
				balance: totalPurchases,
				purchases: purchases,
			})
		} else {
			next(
				createError(
					403,
					'Access token required to complete this operation. Please, use an OIDC flow that issues an access_token'
				)
			)
		}
	} catch (err) {
		next(err)
	}
})

app.get('/api', (request, response) => {
	response.status(200).end('OK')
})

app.get('/api/timestamp', (request, response) => {
	response.send(`${Date.now()}`)
})

// catch 404 and forward to error handler
//app.use((req, res, next) => {
//	next(createError(404))
//})

app.use(requiresAuth(), async (req, res, next) => {
  
  try {
    const token = await getManagementApiToken()
    const userId = req.oidc.user.sub;
    const response = await axios.get(`${process.env.ISSUER_BASE_URL}/api/v2/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.locals.user = response.data;
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.locals.user = req.oidc.user;
  }
  next();
});


/*
app.use((err, req, res, next) => {
  if (err && err.error === 'access_denied') {
    console.log(err);
    //return res.status(403).send(err.error_description);
    
    return res.redirect('/access');
  }
	next(createError(404))
})
*/

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`)
})

module.exports = app
