import React from 'react';

type PasswordStrengthProps = {
	password?: string | null;
};

function computeScore(password: string) {
	let score = 0;
	if (!password) return 0;
	if (password.length >= 8) score += 1;
	if (password.length >= 12) score += 1;
	if (/[a-z]/.test(password)) score += 1;
	if (/[A-Z]/.test(password)) score += 1;
	if (/\d/.test(password)) score += 1;
	if (/[^A-Za-z0-9]/.test(password)) score += 1;
	if (score <= 1) return 0;
	if (score === 2) return 1;
	if (score === 3) return 2;
	if (score === 4) return 3;
	if (score >= 5) return 4;
	return 0;
}

function scoreLabel(score: number) {
	switch (score) {
		case 0:
			return { text: 'Very weak', color: 'bg-red-500' };
		case 1:
			return { text: 'Weak', color: 'bg-amber-500' };
		case 2:
			return { text: 'Okay', color: 'bg-yellow-400' };
		case 3:
			return { text: 'Good', color: 'bg-green-400' };
		case 4:
			return { text: 'Strong', color: 'bg-green-600' };
		default:
			return { text: 'Very weak', color: 'bg-red-500' };
	}
}

export function PasswordStrength({ password = '' }: PasswordStrengthProps) {
	const score = computeScore(password || '');
	const { text, color } = scoreLabel(score);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<span>Password strength</span>
				<span className="font-medium">{text}</span>
			</div>

			<div className="w-full bg-slate-200 dark:bg-slate-700 rounded h-2 overflow-hidden">
				<div
					className={`${color} h-2 transition-all duration-200`}
					style={{ width: `${((score + 1) / 5) * 100}%` }}
					aria-hidden
				/>
			</div>
		</div>
	);
}

export default PasswordStrength;
