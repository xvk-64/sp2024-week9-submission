import React, {StrictMode} from 'react';
import {App} from "./App.js";
import {createRoot} from "react-dom/client";


const container = document.getElementById('root');
const root = createRoot(container!);

// esbuild live reload
new EventSource('/esbuild').addEventListener('change', () => location.reload())

root.render(<StrictMode><App/></StrictMode>)
