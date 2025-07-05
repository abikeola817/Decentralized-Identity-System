;; Access Control Contract
;; Manages permissions and access rights for services

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u400))
(define-constant ERR_PERMISSION_NOT_FOUND (err u401))
(define-constant ERR_ALREADY_GRANTED (err u402))
(define-constant ERR_INVALID_INPUT (err u403))
(define-constant ERR_INSUFFICIENT_REPUTATION (err u404))

;; Data Variables
(define-data-var next-permission-id uint u1)

;; Data Maps
(define-map service-permissions
  { service: (string-ascii 32), identity-id: uint }
  {
    granted: bool,
    granted-at: uint,
    granted-by: principal,
    expires-at: (optional uint),
    permission-level: (string-ascii 16)
  }
)

(define-map service-configs
  { service: (string-ascii 32) }
  {
    admin: principal,
    min-reputation: uint,
    requires-verification: bool,
    active: bool
  }
)

(define-map permission-history
  { permission-id: uint }
  {
    service: (string-ascii 32),
    identity-id: uint,
    action: (string-ascii 16),
    performed-by: principal,
    performed-at: uint
  }
)

;; Public Functions

;; Register a new service
(define-public (register-service (service (string-ascii 32)) (min-reputation uint) (requires-verification bool))
  (begin
    (asserts! (> (len service) u0) ERR_INVALID_INPUT)
    (asserts! (<= min-reputation u1000) ERR_INVALID_INPUT)

    (map-set service-configs
      { service: service }
      {
        admin: tx-sender,
        min-reputation: min-reputation,
        requires-verification: requires-verification,
        active: true
      }
    )
    (ok true)
  )
)

;; Update service configuration
(define-public (update-service-config (service (string-ascii 32)) (min-reputation uint) (requires-verification bool))
  (let
    (
      (service-config (unwrap! (map-get? service-configs { service: service }) ERR_PERMISSION_NOT_FOUND))
    )
    (asserts! (is-eq (get admin service-config) tx-sender) ERR_UNAUTHORIZED)
    (asserts! (<= min-reputation u1000) ERR_INVALID_INPUT)

    (map-set service-configs
      { service: service }
      (merge service-config {
        min-reputation: min-reputation,
        requires-verification: requires-verification
      })
    )
    (ok true)
  )
)

;; Grant permission to access service
(define-public (grant-permission (service (string-ascii 32)) (identity-id uint) (permission-level (string-ascii 16)) (duration (optional uint)))
  (let
    (
      (service-config (unwrap! (map-get? service-configs { service: service }) ERR_PERMISSION_NOT_FOUND))
      (expires-at (match duration
                    some-duration (some (+ block-height some-duration))
                    none))
      (permission-id (var-get next-permission-id))
    )
    (asserts! (is-eq (get admin service-config) tx-sender) ERR_UNAUTHORIZED)
    (asserts! (get active service-config) ERR_UNAUTHORIZED)
    (asserts! (> (len permission-level) u0) ERR_INVALID_INPUT)

    ;; Check if permission already exists
    (asserts! (is-none (map-get? service-permissions { service: service, identity-id: identity-id }))
              ERR_ALREADY_GRANTED)

    (map-set service-permissions
      { service: service, identity-id: identity-id }
      {
        granted: true,
        granted-at: block-height,
        granted-by: tx-sender,
        expires-at: expires-at,
        permission-level: permission-level
      }
    )

    ;; Record permission history
    (map-set permission-history
      { permission-id: permission-id }
      {
        service: service,
        identity-id: identity-id,
        action: "granted",
        performed-by: tx-sender,
        performed-at: block-height
      }
    )

    (var-set next-permission-id (+ permission-id u1))
    (ok true)
  )
)

;; Revoke permission
(define-public (revoke-permission (service (string-ascii 32)) (identity-id uint))
  (let
    (
      (service-config (unwrap! (map-get? service-configs { service: service }) ERR_PERMISSION_NOT_FOUND))
      (permission (unwrap! (map-get? service-permissions { service: service, identity-id: identity-id })
                          ERR_PERMISSION_NOT_FOUND))
      (permission-id (var-get next-permission-id))
    )
    (asserts! (is-eq (get admin service-config) tx-sender) ERR_UNAUTHORIZED)

    (map-set service-permissions
      { service: service, identity-id: identity-id }
      (merge permission { granted: false })
    )

    ;; Record permission history
    (map-set permission-history
      { permission-id: permission-id }
      {
        service: service,
        identity-id: identity-id,
        action: "revoked",
        performed-by: tx-sender,
        performed-at: block-height
      }
    )

    (var-set next-permission-id (+ permission-id u1))
    (ok true)
  )
)

;; Read-only Functions

;; Check if identity has access to service
(define-read-only (has-access (service (string-ascii 32)) (identity-id uint))
  (match (map-get? service-permissions { service: service, identity-id: identity-id })
    permission
    (and
      (get granted permission)
      (match (get expires-at permission)
        some-expiry (> some-expiry block-height)
        true
      )
    )
    false
  )
)

;; Get service permission details
(define-read-only (get-permission (service (string-ascii 32)) (identity-id uint))
  (map-get? service-permissions { service: service, identity-id: identity-id })
)

;; Get service configuration
(define-read-only (get-service-config (service (string-ascii 32)))
  (map-get? service-configs { service: service })
)

;; Check if identity meets service requirements
(define-read-only (meets-service-requirements (service (string-ascii 32)) (identity-id uint) (reputation-score uint) (has-verification bool))
  (match (map-get? service-configs { service: service })
    config
    (and
      (get active config)
      (>= reputation-score (get min-reputation config))
      (if (get requires-verification config) has-verification true)
    )
    false
  )
)

;; Get permission history
(define-read-only (get-permission-history (permission-id uint))
  (map-get? permission-history { permission-id: permission-id })
)
