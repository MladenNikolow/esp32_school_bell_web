import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loadMode, updateMode, setModeLocal, clearError } from './AppSlice';
import AuthGuard from '../Auth/components/AuthGuard.jsx';

export default function App() {
  return <AuthGuard />;
}