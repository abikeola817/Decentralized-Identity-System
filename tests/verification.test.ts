import { describe, it, expect, beforeEach } from "vitest"

describe("Verification Contract Tests", () => {
  let verificationContract
  const mockBlockHeight = 1000
  const mockTxSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
  const mockVerifier = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
  
  beforeEach(() => {
    verificationContract = {
      nextVerificationId: 1,
      verifications: new Map(),
      verifierPermissions: new Map(),
      identityVerifications: new Map(),
    }
    
    // Initialize contract owner as authorized verifier
    verificationContract.verifierPermissions.set(mockTxSender, {
      authorized: true,
      addedAt: mockBlockHeight,
    })
  })
  
  describe("add-verifier", () => {
    it("should add authorized verifier successfully", () => {
      const result = addVerifier(verificationContract, mockTxSender, mockVerifier, mockBlockHeight)
      
      expect(result.success).toBe(true)
      expect(verificationContract.verifierPermissions.get(mockVerifier).authorized).toBe(true)
    })
    
    it("should fail if not called by contract owner", () => {
      const result = addVerifier(verificationContract, mockVerifier, mockTxSender, mockBlockHeight)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(200) // ERR_UNAUTHORIZED
    })
  })
  
  describe("verify-claim", () => {
    it("should verify claim successfully", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      const result = verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      expect(result.success).toBe(true)
      expect(result.value).toBe(1)
      expect(verificationContract.verifications.size).toBe(1)
      expect(verificationContract.identityVerifications.size).toBe(1)
    })
    
    it("should fail if verifier not authorized", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      const result = verifyClaim(verificationContract, mockVerifier, identityId, claimType, duration, mockBlockHeight)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(200) // ERR_UNAUTHORIZED
    })
    
    it("should fail if claim already verified", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      // First verification
      verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      // Second verification attempt
      const result = verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(202) // ERR_ALREADY_VERIFIED
    })
  })
  
  describe("revoke-verification", () => {
    it("should revoke verification successfully", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      // Create verification first
      verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      // Revoke verification
      const result = revokeVerification(verificationContract, mockTxSender, 1)
      
      expect(result.success).toBe(true)
      
      const verification = verificationContract.verifications.get(1)
      expect(verification.status).toBe("revoked")
    })
    
    it("should fail if not called by original verifier", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      // Create verification first
      verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      // Try to revoke with different user
      const result = revokeVerification(verificationContract, mockVerifier, 1)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(200) // ERR_UNAUTHORIZED
    })
  })
  
  describe("is-claim-verified", () => {
    it("should return true for valid verified claim", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      // Create verification
      verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      const result = isClaimVerified(verificationContract, identityId, claimType, mockBlockHeight + 500)
      
      expect(result).toBe(true)
    })
    
    it("should return false for expired verification", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 100
      
      // Create verification
      verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      
      const result = isClaimVerified(verificationContract, identityId, claimType, mockBlockHeight + 200)
      
      expect(result).toBe(false)
    })
    
    it("should return false for revoked verification", () => {
      const identityId = 1
      const claimType = "email"
      const duration = 1000
      
      // Create and revoke verification
      verifyClaim(verificationContract, mockTxSender, identityId, claimType, duration, mockBlockHeight)
      revokeVerification(verificationContract, mockTxSender, 1)
      
      const result = isClaimVerified(verificationContract, identityId, claimType, mockBlockHeight + 500)
      
      expect(result).toBe(false)
    })
  })
})

// Helper functions
function addVerifier(contract, sender, verifier, blockHeight) {
  if (sender !== "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM") {
    return { success: false, error: 200 }
  }
  
  contract.verifierPermissions.set(verifier, {
    authorized: true,
    addedAt: blockHeight,
  })
  
  return { success: true, value: true }
}

function verifyClaim(contract, sender, identityId, claimType, duration, blockHeight) {
  const verifierAuth = contract.verifierPermissions.get(sender)
  if (!verifierAuth || !verifierAuth.authorized) {
    return { success: false, error: 200 }
  }
  
  if (claimType.length === 0 || duration <= 0) {
    return { success: false, error: 203 }
  }
  
  const verificationKey = `${identityId}-${claimType}`
  if (contract.identityVerifications.has(verificationKey)) {
    return { success: false, error: 202 }
  }
  
  const verificationId = contract.nextVerificationId
  const expiresAt = blockHeight + duration
  
  contract.verifications.set(verificationId, {
    identityId: identityId,
    claimType: claimType,
    verifier: sender,
    verifiedAt: blockHeight,
    expiresAt: expiresAt,
    status: "verified",
  })
  
  contract.identityVerifications.set(verificationKey, verificationId)
  contract.nextVerificationId += 1
  
  return { success: true, value: verificationId }
}

function revokeVerification(contract, sender, verificationId) {
  const verification = contract.verifications.get(verificationId)
  if (!verification) {
    return { success: false, error: 201 }
  }
  
  if (verification.verifier !== sender) {
    return { success: false, error: 200 }
  }
  
  verification.status = "revoked"
  return { success: true, value: true }
}

function isClaimVerified(contract, identityId, claimType, currentBlockHeight) {
  const verificationKey = `${identityId}-${claimType}`
  const verificationId = contract.identityVerifications.get(verificationKey)
  
  if (!verificationId) return false
  
  const verification = contract.verifications.get(verificationId)
  if (!verification) return false
  
  return verification.status === "verified" && verification.expiresAt > currentBlockHeight
}
