# Time Tracking in Account Lock System

## How `account_locked_until` Timestamp Works

### Database Storage Type
```sql
@Column({ type: 'timestamptz', nullable: true })
account_locked_until: Date | null;
```

This is a PostgreSQL TIMESTAMP WITH TIME ZONE column that stores future expiration time.

---

## Time Flow Examples

### Scenario: User Gets Locked After 5 Failed Attempts

#### Step 1: 5th Failed Attempt (Lock Triggered)
**Time:** `2024-01-15 10:06:00`

```javascript
// Code executes
const lockDurationMinutes = 30;
user.account_locked_until = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

// Calculation
Date.now() = 1705315560000  // 2024-01-15 10:06:00
Add 30 minutes = + 1800000 milliseconds
Result = 1705317360000      // 2024-01-15 10:36:00
```

**Database UPDATE:**
```sql
UPDATE users SET 
  failed_otp_attempts = 5,
  account_locked_until = '2024-01-15 10:36:00',  -- ← Lock expires here
  updated_on = '2024-01-15 10:06:00'
WHERE email = 'user@example.com';
```

---

#### Step 2: User Tries Again (Lock Still Active)
**Time:** `2024-01-15 10:20:00` (14 minutes later)

```sql
-- Check lock status
SELECT account_locked_until FROM users WHERE email = 'user@example.com';
-- Returns: '2024-01-15 10:36:00'

-- Code executes
const lockTimeRemaining = Math.ceil((user.account_locked_until.getTime() - Date.now()) / 60000);

// Calculation
Lock time:   1705317360000  // 2024-01-15 10:36:00
Current time: 1705316400000  // 2024-01-15 10:20:00
Difference:     960000       // 16 minutes = 960 seconds = 960,000 ms
960000 / 60000 = 16 minutes
```

**User Response:** 
```
"Account is locked due to too many failed attempts. Try again in 16 minutes."
```

---

#### Step 3: Lock Expires
**Time:** `2024-01-15 10:36:00` or later

```javascript
// Check lock status
if (user.account_locked_until && user.account_locked_until > new Date()) {
  // This is FALSE now because:
  // user.account_locked_until = '2024-01-15 10:36:00'
  // new Date() = '2024-01-15 10:36:01'
  // '2024-01-15 10:36:00' > '2024-01-15 10:36:01' = FALSE
}

// Lock check passes, user can try again
```

**User can now verify OTP or request new OTP**

---

## Time Comparison Logic

### The Check Statement Explained:
```typescript
if (user.account_locked_until && user.account_locked_until > new Date())
```

**Breaking it down:**

1. **`user.account_locked_until`**: Database timestamp (or NULL)
2. **`&&`**: Logical AND (both conditions must be true)
3. **`user.account_locked_until > new Date()`**: Is lock timestamp in the future?

### States:

| Condition | Result | Meaning |
|-----------|--------|---------|
| `NULL` | `false` | Account not locked |
| `'2024-01-15 10:36:00' > '2024-01-15 10:40:00'` | `false` | Lock expired, user can try |
| `'2024-01-15 10:36:00' > '2024-01-15 10:20:00'` | `true` | Lock active, reject request |

---

## Visual Timeline

```
Timeline: 10:00 → 10:06 → 10:20 → 10:36 → 10:40
          │      │      │      │      │
          │      │      │      │      └─ Lock expired
          │      │      │      └─ Lock expires (can try)
          │      │      └─ User tries (LOCKED, 16 min wait)
          │      └─ 5th wrong OTP (LOCKED, 30 min timer set)
          └─ User starts verification

User Actions:
10:00-10:05: Attempt 1-4 (wrong OTP)
10:06:       Attempt 5 (wrong OTP) → ACCOUNT LOCKED!
            account_locked_until = 10:36 (30 min lock)
10:20:       Try again → REJECTED (16 minutes remaining)
10:36:       Try again → ALLOWED (lock expired)
```

---

## Code Locations

### 1. Setting the Lock Time
```typescript:179:182:src/auth/auth.service.ts
      // Lock account after 5 failed attempts
      if (user.failed_otp_attempts >= 5) {
        const lockDurationMinutes = 30; // Lock for 30 minutes
        user.account_locked_until = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
```

**Formula:** `current_time + (30 minutes * 60 seconds * 1000 milliseconds)`

---

### 2. Checking if Locked
```typescript:160:164:src/auth/auth.service.ts
    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      const lockTimeRemaining = Math.ceil((user.account_locked_until.getTime() - Date.now()) / 60000);
      throw new BadRequestException(
        `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`
```

**Formula:** `(lock_expiration - current_time) / 60000` = minutes remaining

---

### 3. Clearing the Lock (When Successful)
```typescript:205:210:src/auth/auth.service.ts
    // Reset failed attempts on successful verification
    user.is_verified = true;
    user.email_verified_at = new Date();
    user.failed_otp_attempts = 0;
    user.account_locked_until = null;
    await this.usersRepository.save(user);
```

Sets to `NULL` to clear the lock.

---

## Real-World Example

### User "john@example.com" Gets Locked

```sql
-- Initial registration
INSERT INTO users (email, is_verified, failed_otp_attempts, account_locked_until)
VALUES ('john@example.com', FALSE, 0, NULL);

-- Attempt 1 (wrong OTP)
UPDATE users SET failed_otp_attempts = 1 WHERE email = 'john@example.com';
-- account_locked_until = NULL

-- Attempt 2
UPDATE users SET failed_otp_attempts = 2 WHERE email = 'john@example.com';
-- account_locked_until = NULL

-- Attempt 3
UPDATE users SET failed_otp_attempts = 3 WHERE email = 'john@example.com';
-- account_locked_until = NULL

-- Attempt 4
UPDATE users SET failed_otp_attempts = 4 WHERE email = 'john@example.com';
-- account_locked_until = NULL

-- Attempt 5 (LOCKED!)
UPDATE users SET 
  failed_otp_attempts = 5,
  account_locked_until = '2024-01-15 10:36:00'  -- Lock for 30 minutes
WHERE email = 'john@example.com';

-- User tries again at 10:20:00
SELECT account_locked_until FROM users WHERE email = 'john@example.com';
-- Returns: '2024-01-15 10:36:00'
-- Current time: '2024-01-15 10:20:00'
-- Lock is ACTIVE (10:36 > 10:20)
-- Reject: "Try again in 16 minutes"

-- User tries again at 10:40:00
-- account_locked_until = '2024-01-15 10:36:00'
-- Current time: '2024-01-15 10:40:00'
-- Lock is EXPIRED (10:36 < 10:40)
-- Allow request

-- User verifies correctly
UPDATE users SET 
  is_verified = TRUE,
  email_verified_at = '2024-01-15 10:40:00',
  failed_otp_attempts = 0,
  account_locked_until = NULL
WHERE email = 'john@example.com';
```

---

## Key Points

1. **PostgreSQL TIMESTAMPTZ stores the timestamp**
2. **JavaScript `new Date()` calculates future time**
3. **Comparison checks if timestamp is in the future**
4. **Time remaining calculated using difference in milliseconds**
5. **Automatic expiry when timestamp passes current time**
6. **No cron job needed - checked on each request**

---

## Mathematical Operations

### Setting Lock:
```javascript
const now = Date.now();                    // 1705315560000
const lockMs = 30 * 60 * 1000;             // 1800000
const futureTime = now + lockMs;           // 1705317360000
user.account_locked_until = new Date(futureTime);
```

### Checking Lock:
```javascript
const lockTime = user.account_locked_until.getTime();  // 1705317360000
const now = Date.now();                                 // 1705316400000
const diffMs = lockTime - now;                          // 960000
const diffMinutes = diffMs / 60000;                     // 16
const rounded = Math.ceil(diffMinutes);                // 16 minutes
```

---

## Summary

✅ **Lock Time:** Set to current time + 30 minutes  
✅ **Check Time:** Compare lock timestamp with current time  
✅ **Expiry Time:** Automatic when current time > lock time  
✅ **Remaining Time:** Calculate difference and show to user  
✅ **Storage:** PostgreSQL TIMESTAMPTZ in database  
✅ **No Background Jobs:** Checked on-demand in real-time  

The system uses standard JavaScript Date objects and PostgreSQL timestamps to track lock duration automatically!

