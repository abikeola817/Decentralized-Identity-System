;; Verification Contract
;; Handles claim verification and attestation

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_VERIFICATION_NOT_FOUND (err u201))
(define-constant ERR_ALREADY_VERIFIED (err u202))
(define-constant ERR_INVALID_INPUT (err u203))
(define-constant ERR_IDENTITY_NOT_FOUND (err u204))

;; Data Variables
(define-data-var next-verification-id uint u1)

;; Data Maps
(define-map verifications
  { verification-id: uint }
  {
    identity-id: uint,
    claim-type: (string-ascii 32),
    verifier: principal,
    verified-at: uint,
    expires-at: uint,
    status: (string-ascii 16)
  }
)

(define-map verifier-permissions
  { verifier: principal }
  { authorized: bool, added-at: uint }
)

(define-map identity-verifications
  { identity-id: uint, claim-type: (string-ascii 32) }
  { verification-id: uint }
)

;; Initialize contract owner as authorized verifier
(map-set verifier-permissions
  { verifier: CONTRACT_OWNER }
  { authorized: true, added-at: block-height }
)

;; Public Functions

;; Add authorized verifier (only contract owner)
(define-public (add-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (map-set verifier-permissions
      { verifier: verifier }
      { authorized: true, added-at: block-height }
    )
    (ok true)
  )
)

;; Remove verifier authorization
(define-public (remove-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (map-set verifier-permissions
      { verifier: verifier }
      { authorized: false, added-at: block-height }
    )
    (ok true)
  )
)

;; Submit verification for a claim
(define-public (verify-claim (identity-id uint) (claim-type (string-ascii 32)) (duration uint))
  (let
    (
      (verification-id (var-get next-verification-id))
      (verifier-auth (default-to { authorized: false, added-at: u0 }
                      (map-get? verifier-permissions { verifier: tx-sender })))
      (expires-at (+ block-height duration))
    )
    (asserts! (get authorized verifier-auth) ERR_UNAUTHORIZED)
    (asserts! (> (len claim-type) u0) ERR_INVALID_INPUT)
    (asserts! (> duration u0) ERR_INVALID_INPUT)

    ;; Check if already verified
    (asserts! (is-none (map-get? identity-verifications
                       { identity-id: identity-id, claim-type: claim-type }))
              ERR_ALREADY_VERIFIED)

    (map-set verifications
      { verification-id: verification-id }
      {
        identity-id: identity-id,
        claim-type: claim-type,
        verifier: tx-sender,
        verified-at: block-height,
        expires-at: expires-at,
        status: "verified"
      }
    )

    (map-set identity-verifications
      { identity-id: identity-id, claim-type: claim-type }
      { verification-id: verification-id }
    )

    (var-set next-verification-id (+ verification-id u1))
    (ok verification-id)
  )
)

;; Revoke verification
(define-public (revoke-verification (verification-id uint))
  (let
    (
      (verification (unwrap! (map-get? verifications { verification-id: verification-id })
                            ERR_VERIFICATION_NOT_FOUND))
    )
    (asserts! (is-eq (get verifier verification) tx-sender) ERR_UNAUTHORIZED)

    (map-set verifications
      { verification-id: verification-id }
      (merge verification { status: "revoked" })
    )
    (ok true)
  )
)

;; Read-only Functions

;; Get verification by ID
(define-read-only (get-verification (verification-id uint))
  (map-get? verifications { verification-id: verification-id })
)

;; Check if claim is verified and valid
(define-read-only (is-claim-verified (identity-id uint) (claim-type (string-ascii 32)))
  (match (map-get? identity-verifications { identity-id: identity-id, claim-type: claim-type })
    verification-ref
    (match (map-get? verifications { verification-id: (get verification-id verification-ref) })
      verification
      (and
        (is-eq (get status verification) "verified")
        (> (get expires-at verification) block-height)
      )
      false
    )
    false
  )
)

;; Check if user is authorized verifier
(define-read-only (is-authorized-verifier (verifier principal))
  (default-to false
    (get authorized (map-get? verifier-permissions { verifier: verifier }))
  )
)

;; Get verification for identity claim
(define-read-only (get-identity-verification (identity-id uint) (claim-type (string-ascii 32)))
  (map-get? identity-verifications { identity-id: identity-id, claim-type: claim-type })
)
