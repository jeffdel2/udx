# Okta FGA Integration Setup Guide

This guide will help you set up Okta FGA (Fine-Grained Authorization) integration with your Universal Parks application.

## Prerequisites

1. **Okta FGA Account**: You need an Okta FGA account with API access
2. **Node.js Application**: Your existing Universal Parks application
3. **Environment Variables**: Configure the required environment variables

## Step 1: Set Up Okta FGA

### 1.1 Create an Okta FGA Store

1. Log into your Okta FGA dashboard
2. Create a new store for your application
3. Note down the Store ID

### 1.2 Create API Credentials

1. In your Okta FGA dashboard, create a new API client
2. Note down the Client ID and Client Secret
3. Ensure the client has the necessary permissions

### 1.3 Create Authorization Model

1. Use the provided `fga-model.json` file as your authorization model
2. Upload this model to your FGA store
3. Note down the Authorization Model ID

## Step 2: Configure Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Okta FGA Configuration
OKTA_FGA_API_URL=https://api.fga.us
OKTA_FGA_STORE_ID=your-store-id
OKTA_FGA_CLIENT_ID=your-client-id
OKTA_FGA_CLIENT_SECRET=your-client-secret
OKTA_FGA_AUTHORIZATION_MODEL_ID=your-authorization-model-id
```

## Step 3: Install Dependencies

The FGA integration uses `axios` which is already included in your project.

## Step 4: Initialize the FGA Integration

Run the setup script to initialize the authorization model and create initial relationships:

```bash
node setup-fga.js
```

This script will:
- Validate your environment variables
- Upload the authorization model to FGA
- Create initial relationships for demo users

## Step 5: Test the Integration

### 5.1 Test Authorization Checks

The application now includes FGA authorization checks on the following routes:

- **Tickets Page**: Requires `can_access` permission on `tickets`
- **Add to Cart**: Requires `can_purchase` permission on `tickets`
- **Checkout Page**: Requires `can_access` permission on `checkout`
- **Process Payment**: Requires `can_process` permission on `payments`
- **Profile View**: Requires `can_view` permission on `profile`
- **Profile Edit**: Requires `can_edit` permission on `profile`

### 5.2 Grant Permissions to Users

Use the FGA integration methods to grant permissions to users:

```javascript
const { OktaFGAIntegration } = require('./fga-integration');

const fga = new OktaFGAIntegration();

// Grant ticket access to a user
await fga.grantTicketAccess('auth0|user-id');

// Grant purchase permission
await fga.grantPurchasePermission('auth0|user-id');

// Grant profile permissions
await fga.grantProfileViewPermission('auth0|user-id', 'auth0|user-id');
await fga.grantProfileEditPermission('auth0|user-id', 'auth0|user-id');
```

## Authorization Model Overview

The FGA authorization model defines the following relationships:

### Resources and Permissions

1. **Tickets**
   - `can_access`: View available tickets
   - `can_purchase`: Add tickets to cart

2. **Profile**
   - `can_view`: View user profile
   - `can_edit`: Edit user profile

3. **Checkout**
   - `can_access`: Access checkout page

4. **Payments**
   - `can_process`: Process payments

5. **Admin**
   - `can_manage`: Administrative access

## API Methods

### Authorization Checks

```javascript
// Check if user can access tickets
const canView = await fga.canViewTickets(userId);

// Check if user can view profile
const canViewProfile = await fga.canViewProfile(userId, profileUserId);

// Grant ticket view access
await fga.grantTicketViewAccess(userId);

// Grant profile view permission
await fga.grantProfileViewPermission(userId, profileUserId);
```

### Granting Permissions

```javascript
// Grant ticket access
await fga.grantTicketAccess(userId);

// Grant purchase permission
await fga.grantPurchasePermission(userId);

// Grant profile permissions
await fga.grantProfileViewPermission(userId, profileUserId);
await fga.grantProfileEditPermission(userId, profileUserId);
```

### Removing Permissions

```javascript
// Remove a specific relationship
await fga.removeRelationship(userId, 'can_access', 'tickets');
```

## Error Handling

The integration includes comprehensive error handling:

- **Authentication Errors**: Returns 401 for unauthenticated requests
- **Authorization Errors**: Returns 403 for unauthorized requests
- **API Errors**: Logs errors and returns appropriate HTTP status codes

## Security Considerations

1. **Environment Variables**: Keep your FGA credentials secure
2. **Token Management**: Access tokens are cached and refreshed automatically
3. **Error Logging**: Sensitive information is not logged
4. **Fallback Behavior**: Authorization failures default to deny

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all required FGA environment variables are set
   - Check the variable names match exactly

2. **Authentication Errors**
   - Verify your FGA client credentials
   - Check that your FGA store is active

3. **Authorization Model Errors**
   - Ensure the authorization model is properly uploaded
   - Check the model ID matches your FGA store

4. **Permission Denied Errors**
   - Verify that relationships exist in FGA
   - Check that users have the required permissions

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=fga:*
```

## Next Steps

1. **Customize the Authorization Model**: Modify `fga-model.json` to match your specific requirements
2. **Add More Resources**: Extend the model to include additional application resources
3. **Implement Role-Based Access**: Create roles and assign them to users
4. **Add Audit Logging**: Track authorization decisions for compliance
5. **Performance Optimization**: Implement caching for frequently checked permissions

      console.log("Access token:", this.accessToken);
## Support

For issues with the FGA integration:

1. Check the application logs for error messages
2. Verify your FGA configuration
3. Test the FGA API directly using the provided credentials
4. Review the Okta FGA documentation for API details 