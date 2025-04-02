// Central definition of belt colors and ranks
export const BELT_RANKS = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'red', 'brown', 'black'] as const;

export const beltColorMap: Record<string, string> = {
    white: 'bg-white border border-gray-300',
    yellow: 'bg-yellow-200',
    orange: 'bg-orange-300',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    red: 'bg-red-600',
    brown: 'bg-yellow-800',
    black: 'bg-black',
};
