// Simple script to update SECURITY and ADMIN users to have premium and verified status
import { storage } from './storage';
import { UserRole } from '@shared/schema';

async function updateStaffUsers() {
  try {
    console.log('Updating SECURITY and ADMIN users to premium and verified status...');
    
    const allUsers = await storage.getAllUsers();
    const staffUsers = allUsers.filter(user => 
      user.role === UserRole.SECURITY || user.role === UserRole.ADMIN
    );
    
    const updatedUsers = [];
    for (const user of staffUsers) {
      const updatedUser = await storage.updateUser(user.id, {
        isPremium: true,
        isVerified: true,
      });
      updatedUsers.push({
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        isPremium: updatedUser.isPremium,
        isVerified: updatedUser.isVerified
      });
    }
    
    console.log(`Updated ${updatedUsers.length} staff users with premium and verified status`);
    console.log('Updated users:', JSON.stringify(updatedUsers, null, 2));
    
  } catch (error) {
    console.error('Error updating staff users:', error);
    process.exit(1);
  }
}

updateStaffUsers(); 