require('dotenv').config();
const axios = require('axios');

/**
 * Okta FGA (Fine-Grained Authorization) Integration
 * This module provides integration with Okta FGA for fine-grained authorization
 */

class OktaFGAIntegration {
  constructor() {
    this.fgaApiUrl = process.env.OKTA_FGA_API_URL || 'https://api.fga.us';
    this.storeId = process.env.OKTA_FGA_STORE_ID;
    this.clientId = process.env.OKTA_FGA_CLIENT_ID;
    this.clientSecret = process.env.OKTA_FGA_CLIENT_SECRET;
    this.tokenIssuer = process.env.OKTA_FGA_TOKEN_ISSUER;
    //this.authorizationModelId = process.env.OKTA_FGA_AUTHORIZATION_MODEL_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token for FGA API
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`https://${this.tokenIssuer}/oauth/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        audience: 'https://api.us1.fga.dev/'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      //console.error("Access token success:", this.accessToken);
      
      return this.accessToken;
    } catch (error) {
      console.error("Access token error:", this.accessToken);
      console.error('Error getting FGA access token:', error.message);
      throw error;
    }
  }

  /**
   * Check if a user can perform an action on a resource
   */
  async checkAuthorization(userId, action, resource, context = {}) {
    try {
      const token = await this.getAccessToken();

      console.log("Access token in check call:", this.accessToken);
      
      const response = await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/check`,
        {
          tuple_key: {
            user: `user:${userId}`,
            relation: action,
            object: resource
          },
          context: context
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.allowed;
    } catch (error) {
      console.error('Error checking authorization:', error.message);
      return false;
    }
  }

  /**
   * List all objects a user can access for a specific relation
   */
  async listObjects(userId, relation, objectType) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/list-objects`,
        {
          tuple_key: {
            user: `user:${userId}`,
            relation: relation,
            type: `${objectType}:*`
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.objects;
    } catch (error) {
      console.error('Error listing objects:', error.message);
      return [];
    }
  }

  /**
   * Create a relationship between user, action, and resource
   */
  async createRelationship(userId, action, resource) {
    try {
      const token = await this.getAccessToken();
      
      await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/write`,
        {
          writes: {
            tuple_keys: [{
              user: `user:${userId}`,
              relation: action,
              object: resource
            }]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error creating relationship:', error.message);
      return false;
    }
  }

  /**
   * Remove a relationship between user, action, and resource
   */
  async removeRelationship(userId, action, resource) {
    try {
      const token = await this.getAccessToken();
      
      await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/write`,
        {
          deletes: {
            tuple_keys: [{
              user: `user:${userId}`,
              relation: action,
              object: resource
            }]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error removing relationship:', error.message);
      return false;
    }
  }

  /**
   * Check if user can view tickets
   */
  async canViewTickets(userId) {
    return await this.checkAuthorization(userId, 'can_view', 'tickets');
  }

  /**
   * Get all ticket relationships for a user
   */
  async getUserTicketRelationships(userId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/list-objects`,
        {
            user: `user:${userId}`,
            relation: 'can_view',
            type: 'tickets'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.objects || [];
    } catch (error) {
      console.error('Error getting user ticket relationships:', error.message);
      return [];
    }
  }

  /**
   * Get all relationships for a user (all object types)
   */
  async getAllUserRelationships(userId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/list-objects`,
        {
            user: `user:${userId}`,
            relation: 'can_view',
            type: 'tickets'
          },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log("All user relationships:", response);
      return response.data.objects || [];
    } catch (error) {
      console.error('Error getting all user relationships from list-objects:', error.message);
      return [];
    }
  }

  /**
   * Check if user can view profile
   */
  async canViewProfile(userId, profileUserId) {
    return await this.checkAuthorization(userId, 'can_view', `profile:${profileUserId}`);
  }

  /**
   * Grant user view access to tickets
   */
  async grantTicketViewAccess(userId) {
    return await this.createRelationship(userId, 'can_view', 'tickets');
  }

  /**
   * Grant user profile view permission
   */
  async grantProfileViewPermission(userId, profileUserId) {
    return await this.createRelationship(userId, 'can_view', `profile:${profileUserId}`);
  }

  /**
   * Create a purchase tuple for a ticket
   */
  async createTicketPurchase(userId, ticketId, ticketName, transactionId) {
    try {
      const token = await this.getAccessToken();
      
      // Create a purchase relationship
      const response = await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/write`,
        {
          writes: {
            tuple_keys: [{
              user: `user:${userId}`,
              relation: 'purchased',
              object: `tickets:${ticketId}`
            }]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Created purchase tuple for user ${userId}, ticket ${ticketId}, transaction ${transactionId}`);
      return true;
    } catch (error) {
      console.error('Error creating ticket purchase tuple:', error.message);
      if (error.response) {
        console.error('FGA API error response on POST:', error.response.data);
      }
      return false;
    }
  }

  /**
   * Get all purchased tickets for a user
   */
  async getUserPurchasedTickets(userId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.fgaApiUrl}/stores/${this.storeId}/list-objects`,
        {
            user: `user:${userId}`,
            relation: 'purchased',
            type: 'tickets'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('FGA purchased tickets response:', response.data);
      return response.data.objects || [];
    } catch (error) {
      console.error('Error getting user purchased tickets:', error.message);
      if (error.response) {
        console.error('FGA API error response on GET:', error.response.data);
      }
      return [];
    }
  }
}

// Create middleware for authorization checks
const createAuthMiddleware = (fgaIntegration) => {
  return (action, resource, contextProvider = null) => {
    return async (req, res, next) => {
      try {
        if (!req.oidc || !req.oidc.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.oidc.user.sub;
        const context = contextProvider ? contextProvider(req) : {};
        
        const isAuthorized = await fgaIntegration.checkAuthorization(
          userId, 
          action, 
          resource, 
          context
        );

        if (!isAuthorized) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: `You don't have permission to ${action} ${resource}`
          });
        }

        next();
      } catch (error) {
        console.error('Authorization middleware error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  };
};

module.exports = {
  OktaFGAIntegration,
  createAuthMiddleware
}; 