# Messaging System Documentation

## Overview
The messaging system enables direct one-on-one communication between partners and editors within the RPP Central application.

## Features
- ✅ One-on-one messaging between users
- ✅ Conversation threading with message history
- ✅ Real-time message updates
- ✅ Read receipts
- ✅ Search conversations
- ✅ Multi-tenant data isolation
- ✅ Works for both partners and editors

## How to Use

### For Partners

1. **Access Messages**: Click "Messages" in the left sidebar navigation
2. **Start New Conversation**: Click the "New Message" button in the top right
3. **Select Recipient**: Choose a team member or editor from the dialog
4. **Send Messages**: Type your message and click Send or press Enter
5. **View Conversations**: All your conversations appear in the left panel
6. **Search**: Use the search box to find conversations by name

### For Editors

1. **Access Messages**: Click "Messages" in the left sidebar navigation
2. **Start New Conversation**: Click the "New Message" button in the top right
3. **Select Recipient**: Choose a partner to message from the dialog
4. **Send Messages**: Type your message and click Send or press Enter

## API Endpoints

All messaging endpoints require authentication.

### Get Conversations
```
GET /api/conversations
Authorization: Bearer {firebase-token}
```
Returns all conversations for the authenticated user.

**Response:**
```json
[
  {
    "id": "conv-uuid",
    "partnerId": "partner-id",
    "participant1Id": "user-id-1",
    "participant1Name": "John Doe",
    "participant1Role": "partner",
    "participant2Id": "user-id-2",
    "participant2Name": "Jane Smith",
    "participant2Role": "editor",
    "lastMessageContent": "Hello!",
    "lastMessageAt": "2025-10-21T00:00:00.000Z",
    "lastMessageBy": "user-id-1",
    "createdAt": "2025-10-20T00:00:00.000Z",
    "updatedAt": "2025-10-21T00:00:00.000Z"
  }
]
```

### Create/Get Conversation
```
POST /api/conversations
Authorization: Bearer {firebase-token}
Content-Type: application/json

{
  "recipientId": "user-id",
  "recipientName": "John Doe",
  "recipientRole": "editor"
}
```
Creates a new conversation or returns an existing one between the current user and the recipient.

### Get Messages
```
GET /api/conversations/{conversationId}/messages
Authorization: Bearer {firebase-token}
```
Returns all messages in a conversation.

**Response:**
```json
[
  {
    "id": "msg-uuid",
    "conversationId": "conv-uuid",
    "senderId": "user-id",
    "senderName": "John Doe",
    "senderRole": "partner",
    "content": "Hello!",
    "readBy": "[\"user-id-1\",\"user-id-2\"]",
    "readAt": "2025-10-21T00:00:00.000Z",
    "createdAt": "2025-10-21T00:00:00.000Z",
    "updatedAt": "2025-10-21T00:00:00.000Z"
  }
]
```

### Send Message
```
POST /api/conversations/{conversationId}/messages
Authorization: Bearer {firebase-token}
Content-Type: application/json

{
  "content": "Hello, how are you?"
}
```
Sends a message in a conversation.

### Mark Message as Read
```
PATCH /api/messages/{messageId}/read
Authorization: Bearer {firebase-token}
```
Marks a message as read by the current user.

## Database Schema

### Conversations Table
```sql
CREATE TABLE conversations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  partnerId TEXT NOT NULL,
  participant1Id TEXT NOT NULL,
  participant1Name TEXT NOT NULL,
  participant1Role TEXT NOT NULL,
  participant2Id TEXT NOT NULL,
  participant2Name TEXT NOT NULL,
  participant2Role TEXT NOT NULL,
  lastMessageContent TEXT,
  lastMessageAt TIMESTAMP,
  lastMessageBy TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  conversationId VARCHAR NOT NULL REFERENCES conversations(id),
  senderId TEXT NOT NULL,
  senderName TEXT NOT NULL,
  senderRole TEXT NOT NULL,
  content TEXT NOT NULL,
  readBy TEXT, -- JSON array of user IDs
  readAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

## Implementation Details

### Frontend Components

**Location**: `client/src/pages/Messages.tsx`

The Messages page includes:
- Conversation list panel with search
- Message view panel with header
- Message composer with input and send button
- "New Message" dialog for starting conversations
- Real-time updates using TanStack React Query

### Backend Storage

**Location**: `server/storage.ts`

Storage methods:
- `getConversations(userId, partnerId)` - Get user's conversations
- `getOrCreateConversation(...)` - Smart conversation creation
- `updateConversationLastMessage(...)` - Update preview
- `getMessages(conversationId)` - Get conversation messages
- `createMessage(...)` - Create new message
- `markMessageAsRead(messageId, userId)` - Track read status

### API Routes

**Location**: `server/routes.ts` (lines 1193-1354)

All routes require Firebase authentication via the `requireAuth` middleware.

## Testing the Messaging System

### Manual Testing Steps

1. **Setup**: Ensure you have at least 2 users in the system (can be partner + editor)

2. **Test New Conversation**:
   - Login as User A
   - Go to Messages page
   - Click "New Message"
   - Select User B from the list
   - Verify conversation is created

3. **Test Sending Messages**:
   - Type a message in the input
   - Click Send or press Enter
   - Verify message appears in the chat

4. **Test Receiving Messages**:
   - Login as User B (different browser/incognito)
   - Go to Messages page
   - Verify conversation with User A appears
   - Click on the conversation
   - Verify User A's messages are visible

5. **Test Reply**:
   - As User B, send a reply
   - Switch back to User A
   - Verify User B's reply appears

6. **Test Search**:
   - Create multiple conversations
   - Use the search box to filter conversations
   - Verify search works

### API Testing with curl

```bash
# Set your Firebase token
TOKEN="your-firebase-id-token"

# Get conversations
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/conversations

# Create conversation
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipientId":"user-id","recipientName":"John Doe","recipientRole":"editor"}' \
  http://localhost:5000/api/conversations

# Get messages
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/conversations/CONV_ID/messages

# Send message
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello!"}' \
  http://localhost:5000/api/conversations/CONV_ID/messages
```

## Troubleshooting

### Messages not appearing
- Check browser console for API errors
- Verify authentication token is valid
- Check network tab for failed requests

### "No team members available"
- Ensure you have other users in the system
- Check that `/api/users` endpoint returns users
- Verify users have different IDs

### Send button doesn't work
- Check that you've selected a conversation
- Verify message input is not empty
- Check browser console for errors
- Verify API endpoint is reachable

### Conversations not loading
- Check authentication is working
- Verify `/api/conversations` endpoint returns data
- Check partnerId is set correctly
- Look for errors in server logs

## Future Enhancements

Potential improvements:
- WebSocket support for real-time messaging
- Typing indicators
- File/image attachments
- Group messaging
- Message deletion/editing
- Emoji reactions
- Push notifications
- Unread message count
- Message threading
- Voice messages
