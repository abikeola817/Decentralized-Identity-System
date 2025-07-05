import { describe, it, expect, beforeEach } from "vitest"

describe("Access Control Contract Tests", () => {
  let accessControlContract
  const mockBlockHeight = 1000
  const mockTxSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
  const mockUser = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
  
  beforeEach(() => {
    accessControlContract = {
      nextPermissionId: 1,
      servicePermissions: new Map(),
      serviceConfigs: new Map(),
      permissionHistory: new Map(),
    }
  })
  
  describe("register-service", () => {
    it("should register service successfully", () => {
      const service = "test-service"
      const minReputation = 500
      const requiresVerification = true
      
      const result = registerService(accessControlContract, mockTxSender, service, minReputation, requiresVerification)
      
      expect(result.success).toBe(true)
      expect(accessControlContract.serviceConfigs.get(service).admin).toBe(mockTxSender)
      expect(accessControlContract.serviceConfigs.get(service).minReputation).toBe(minReputation)
      expect(accessControlContract.serviceConfigs.get(service).requiresVerification).toBe(requiresVerification)
    })
    
    it("should fail with empty service name", () => {
      const result = registerService(accessControlContract, mockTxSender, "", 500, true)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(403) // ERR_INVALID_INPUT
    })
    
    it("should fail with invalid reputation threshold", () => {
      const result = registerService(accessControlContract, mockTxSender, "test-service", 1500, true)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(403) // ERR_INVALID_INPUT
    })
  })
  
  describe("grant-permission", () => {
    it("should grant permission successfully", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Register service first
      registerService(accessControlContract, mockTxSender, service, 500, true)
      
      const result = grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(true)
      expect(accessControlContract.servicePermissions.size).toBe(1)
      expect(accessControlContract.permissionHistory.size).toBe(1)
    })
    
    it("should fail if not service admin", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Register service with different admin
      registerService(accessControlContract, mockTxSender, service, 500, true)
      
      // Try to grant permission as different user
      const result = grantPermission(
          accessControlContract,
          mockUser,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(400) // ERR_UNAUTHORIZED
    })
    
    it("should fail if permission already granted", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Register service and grant permission
      registerService(accessControlContract, mockTxSender, service, 500, true)
      grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      // Try to grant again
      const result = grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(402) // ERR_ALREADY_GRANTED
    })
  })
  
  describe("revoke-permission", () => {
    it("should revoke permission successfully", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Setup: register service and grant permission
      registerService(accessControlContract, mockTxSender, service, 500, true)
      grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      // Revoke permission
      const result = revokePermission(accessControlContract, mockTxSender, service, identityId, mockBlockHeight)
      
      expect(result.success).toBe(true)
      
      const permission = accessControlContract.servicePermissions.get(`${service}-${identityId}`)
      expect(permission.granted).toBe(false)
    })
    
    it("should fail if not service admin", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Setup: register service and grant permission
      registerService(accessControlContract, mockTxSender, service, 500, true)
      grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      // Try to revoke as different user
      const result = revokePermission(accessControlContract, mockUser, service, identityId, mockBlockHeight)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(400) // ERR_UNAUTHORIZED
    })
  })
  
  describe("has-access", () => {
    it("should return true for valid permission", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Setup: register service and grant permission
      registerService(accessControlContract, mockTxSender, service, 500, true)
      grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      const result = hasAccess(accessControlContract, service, identityId, mockBlockHeight + 500)
      
      expect(result).toBe(true)
    })
    
    it("should return false for expired permission", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 100
      
      // Setup: register service and grant permission
      registerService(accessControlContract, mockTxSender, service, 500, true)
      grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      
      const result = hasAccess(accessControlContract, service, identityId, mockBlockHeight + 200)
      
      expect(result).toBe(false)
    })
    
    it("should return false for revoked permission", () => {
      const service = "test-service"
      const identityId = 1
      const permissionLevel = "read"
      const duration = 1000
      
      // Setup: register service, grant and revoke permission
      registerService(accessControlContract, mockTxSender, service, 500, true)
      grantPermission(
          accessControlContract,
          mockTxSender,
          service,
          identityId,
          permissionLevel,
          duration,
          mockBlockHeight,
      )
      revokePermission(accessControlContract, mockTxSender, service, identityId, mockBlockHeight)
      
      const result = hasAccess(accessControlContract, service, identityId, mockBlockHeight + 500)
      
      expect(result).toBe(false)
    })
  })
  
  describe("meets-service-requirements", () => {
    it("should return true when all requirements met", () => {
      const service = "test-service"
      const identityId = 1
      const reputationScore = 600
      const hasVerification = true
      
      // Register service with requirements
      registerService(accessControlContract, mockTxSender, service, 500, true)
      
      const result = meetsServiceRequirements(
          accessControlContract,
          service,
          identityId,
          reputationScore,
          hasVerification,
      )
      
      expect(result).toBe(true)
    })
    
    it("should return false when reputation too low", () => {
      const service = "test-service"
      const identityId = 1
      const reputationScore = 400
      const hasVerification = true
      
      // Register service with higher reputation requirement
      registerService(accessControlContract, mockTxSender, service, 500, true)
      
      const result = meetsServiceRequirements(
          accessControlContract,
          service,
          identityId,
          reputationScore,
          hasVerification,
      )
      
      expect(result).toBe(false)
    })
    
    it("should return false when verification required but not provided", () => {
      const service = "test-service"
      const identityId = 1
      const reputationScore = 600
      const hasVerification = false
      
      // Register service requiring verification
      registerService(accessControlContract, mockTxSender, service, 500, true)
      
      const result = meetsServiceRequirements(
          accessControlContract,
          service,
          identityId,
          reputationScore,
          hasVerification,
      )
      
      expect(result).toBe(false)
    })
  })
})

// Helper functions
function registerService(contract, sender, service, minReputation, requiresVerification) {
  if (service.length === 0) {
    return { success: false, error: 403 }
  }
  
  if (minReputation > 1000) {
    return { success: false, error: 403 }
  }
  
  contract.serviceConfigs.set(service, {
    admin: sender,
    minReputation: minReputation,
    requiresVerification: requiresVerification,
    active: true,
  })
  
  return { success: true, value: true }
}

function grantPermission(contract, sender, service, identityId, permissionLevel, duration, blockHeight) {
  const serviceConfig = contract.serviceConfigs.get(service)
  if (!serviceConfig) {
    return { success: false, error: 401 }
  }
  
  if (serviceConfig.admin !== sender) {
    return { success: false, error: 400 }
  }
  
  if (!serviceConfig.active) {
    return { success: false, error: 400 }
  }
  
  if (permissionLevel.length === 0) {
    return { success: false, error: 403 }
  }
  
  const permissionKey = `${service}-${identityId}`
  if (contract.servicePermissions.has(permissionKey)) {
    return { success: false, error: 402 }
  }
  
  const expiresAt = duration ? blockHeight + duration : null
  
  contract.servicePermissions.set(permissionKey, {
    granted: true,
    grantedAt: blockHeight,
    grantedBy: sender,
    expiresAt: expiresAt,
    permissionLevel: permissionLevel,
  })
  
  // Record history
  const permissionId = contract.nextPermissionId
  contract.permissionHistory.set(permissionId, {
    service: service,
    identityId: identityId,
    action: "granted",
    performedBy: sender,
    performedAt: blockHeight,
  })
  
  contract.nextPermissionId += 1
  
  return { success: true, value: true }
}

function revokePermission(contract, sender, service, identityId, blockHeight) {
  const serviceConfig = contract.serviceConfigs.get(service)
  if (!serviceConfig) {
    return { success: false, error: 401 }
  }
  
  if (serviceConfig.admin !== sender) {
    return { success: false, error: 400 }
  }
  
  const permissionKey = `${service}-${identityId}`
  const permission = contract.servicePermissions.get(permissionKey)
  if (!permission) {
    return { success: false, error: 401 }
  }
  
  permission.granted = false
  
  // Record history
  const permissionId = contract.nextPermissionId
  contract.permissionHistory.set(permissionId, {
    service: service,
    identityId: identityId,
    action: "revoked",
    performedBy: sender,
    performedAt: blockHeight,
  })
  
  contract.nextPermissionId += 1
  
  return { success: true, value: true }
}

function hasAccess(contract, service, identityId, currentBlockHeight) {
  const permissionKey = `${service}-${identityId}`
  const permission = contract.servicePermissions.get(permissionKey)
  
  if (!permission || !permission.granted) {
    return false
  }
  
  if (permission.expiresAt && permission.expiresAt <= currentBlockHeight) {
    return false
  }
  
  return true
}

function meetsServiceRequirements(contract, service, identityId, reputationScore, hasVerification) {
  const config = contract.serviceConfigs.get(service)
  if (!config) return false
  
  if (!config.active) return false
  if (reputationScore < config.minReputation) return false
  if (config.requiresVerification && !hasVerification) return false
  
  return true
}
