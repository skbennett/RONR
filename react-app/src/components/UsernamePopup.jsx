import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import './UsernamePopup.css';

function UsernamePopup({ isOpen, onClose, currentUsername, userId }) {
  const [newUsername, setNewUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset state when popup opens/closes or currentUsername changes
  useEffect(() => {
    if (isOpen) {
      setNewUsername('');
      setIsSubmitting(false);
      setError('');
      setSuccess(false);
    }
  }, [isOpen, currentUsername]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    if (!newUsername.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (!userId) {
      setError('User ID not found. Please try logging out and back in.');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Attempting to update username for user:', userId);
      
      // First check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Existing profile:', existingProfile);
      console.log('Check error:', checkError);

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means "no rows returned" which is okay
        console.error('Error checking profile:', checkError);
        setError('Error checking profile: ' + checkError.message);
        setIsSubmitting(false);
        return;
      }

      // If no profile exists, create one
      if (!existingProfile) {
        console.log('No profile found, creating new profile with username:', newUsername.trim());
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, username: newUsername.trim() })
          .select();

        console.log('Insert result:', insertData);
        console.log('Insert error:', insertError);

        if (insertError) {
          if (insertError.code === '23505') {
            setError('Username already taken. Please choose another.');
          } else {
            setError(insertError.message || 'Failed to create profile');
          }
          setIsSubmitting(false);
          return;
        }
      } else {
        // Profile exists, update it
        console.log('Profile found with current username:', existingProfile.username);
        console.log('Updating to new username:', newUsername.trim());
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username: newUsername.trim() })
          .eq('id', userId);

        console.log('Update error:', updateError);

        if (updateError) {
          if (updateError.code === '23505') {
            setError('Username already taken. Please choose another.');
          } else {
            setError(updateError.message || 'Failed to update username');
          }
          setIsSubmitting(false);
          return;
        }

        console.log('Update completed successfully');
        
        // Verify the update by fetching the profile again
        const { data: verifyData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();
        
        console.log('Verified username in database:', verifyData?.username);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose(); // This will trigger the navbar to re-fetch via useEffect
      }, 1000);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred: ' + err.message);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="username-popup-overlay" onClick={onClose}>
      <div className="username-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="username-popup-close" onClick={onClose}>
          &times;
        </button>
        
        <h2>Change Username</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="username-popup-field">
            <label htmlFor="username">New Username:</label>
            <input
              type="text"
              id="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={currentUsername || "Enter new username"}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && <div className="username-popup-error">{error}</div>}
          {success && <div className="username-popup-success">Username updated successfully!</div>}

          <div className="username-popup-buttons">
            <button
              type="button"
              className="username-popup-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="username-popup-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsernamePopup;
