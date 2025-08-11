require('dotenv').config();
const { OktaFGAIntegration } = require('./fga-integration');
const fs = require('fs');
const axios = require('axios');

/**
 * Setup script for Okta FGA integration
 * This script initializes the authorization model and creates initial relationships
 */

async function setupFGA() {
  const fga = new OktaFGAIntegration();
  
  try {
    console.log('Setting up Okta FGA integration...');
    
    // Check if required environment variables are set
    const requiredEnvVars = [
      'OKTA_FGA_STORE_ID',
      'OKTA_FGA_CLIENT_ID', 
      'OKTA_FGA_CLIENT_SECRET',
      'OKTA_FGA_TOKEN_ISSUER'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars);
      console.error('Please set these variables in your .env file');
      console.error('Current environment variables:');
      requiredEnvVars.forEach(varName => {
        console.error(`  ${varName}: ${process.env[varName] ? 'SET' : 'MISSING'}`);
      });
      return;
    }

    console.log('All required environment variables are set');

    // Read the authorization model
    const modelPath = './fga-model.json';
    if (!fs.existsSync(modelPath)) {
      console.error('Authorization model file not found:', modelPath);
      return;
    }

    const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    console.log('Authorization model loaded successfully');

    // Initialize the authorization model in FGA
    //await initializeAuthorizationModel(fga, model);
    
    // Create initial relationships for demo purposes
    await createInitialRelationships(fga);
    
    console.log('FGA setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up FGA:', error.message);
  }
}

async function initializeAuthorizationModel(fga, model) {
  try {
    const token = await fga.getAccessToken();
    
    // Create a new authorization model
    const response = await axios.post(
      `${fga.fgaApiUrl}/stores/${fga.storeId}/authorization-models`,
      model,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Authorization model created successfully');
    console.log('Model ID:', response.data.authorization_model_id);
    return response.data;
  } catch (error) {
    console.error('Error creating authorization model:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function createInitialRelationships(fga) {
  try {
    console.log('Creating initial relationships...');
    
    // Demo user IDs - replace with actual user IDs from your system
    const demoUsers = [
      'auth0|demo-user-1',
      'auth0|demo-user-2', 
      'auth0|admin-user'
    ];
    
    // Grant basic permissions to all demo users
    for (const userId of demoUsers) {
      // Grant ticket view access
      await fga.grantTicketViewAccess(userId);
      console.log(`Granted ticket view access to ${userId}`);
    }
    
    // Note: Admin functionality removed from model to resolve FGA import issues
    console.log('Admin permissions not created - admin type removed from model');
    
    console.log('Initial relationships created successfully');
    
  } catch (error) {
    console.error('Error creating initial relationships:', error.message);
    throw error;
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupFGA().then(() => {
    console.log('Setup completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setupFGA }; 