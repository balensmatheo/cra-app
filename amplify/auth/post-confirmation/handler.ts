import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  
  const client = new CognitoIdentityProviderClient({});
  
  export const handler = async (event: any) => {
    const groupName = 'USERS';
    const userPoolId = event.userPoolId;
    const username = event.userName;
  
    try {
      const command = new AdminAddUserToGroupCommand({
        GroupName: groupName,
        UserPoolId: userPoolId,
        Username: username,
      });
  
      await client.send(command);
      console.log(`✅ User ${username} added to group ${groupName}`);
    } catch (error) {
      console.error(`❌ Error adding user to group:`, error);
    }
  
    return event;
  };