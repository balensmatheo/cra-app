"use client";

import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

interface PasswordConstraintsProps {
  password: string;
}

interface Constraint {
  id: string;
  text: string;
  isValid: (password: string) => boolean;
}

const constraints: Constraint[] = [
  {
    id: 'minLength',
    text: 'Au moins 8 caractères',
    isValid: (password: string) => password.length >= 8
  },
  {
    id: 'uppercase',
    text: 'Au moins une majuscule',
    isValid: (password: string) => /[A-Z]/.test(password)
  },
  {
    id: 'digit',
    text: 'Au moins un chiffre',
    isValid: (password: string) => /\d/.test(password)
  },
  {
    id: 'special',
    text: 'Au moins un caractère spécial (!@#$%^&*)',
    isValid: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  }
];

export default function PasswordConstraints({ password }: PasswordConstraintsProps) {
  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1, color: '#666', fontWeight: 500 }}>
        Votre mot de passe doit contenir :
      </Typography>
      {constraints.map((constraint) => {
        const isValid = constraint.isValid(password);
        return (
          <Box
            key={constraint.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 0.5,
              transition: 'color 0.3s ease'
            }}
          >
            {isValid ? (
              <CheckCircleIcon
                sx={{
                  fontSize: 16,
                  color: '#4caf50',
                  mr: 1,
                  transition: 'color 0.3s ease'
                }}
              />
            ) : (
              <RadioButtonUncheckedIcon
                sx={{
                  fontSize: 16,
                  color: '#999',
                  mr: 1,
                  transition: 'color 0.3s ease'
                }}
              />
            )}
            <Typography
              variant="body2"
              sx={{
                color: isValid ? '#4caf50' : '#999',
                fontSize: 13,
                transition: 'color 0.3s ease',
                fontWeight: isValid ? 500 : 400
              }}
            >
              {constraint.text}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// Export function to validate password
export const validatePassword = (password: string): boolean => {
  return constraints.every(constraint => constraint.isValid(password));
};