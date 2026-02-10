import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

export interface PerformanceDataPoint {
    date: string;
    averageScore: number;
    completionRate?: number;
    totalAttempts?: number;
}

interface PerformanceChartProps {
    data: PerformanceDataPoint[];
    title?: string;
    showCompletionRate?: boolean;
    showAttempts?: boolean;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
    data,
    title,
    showCompletionRate = false,
    showAttempts = false
}) => {
    // Format data for chart
    const chartData = data.map(point => ({
        date: new Date(point.date).toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit' 
        }),
        'Média de Notas': Number(point.averageScore.toFixed(1)),
        'Taxa de Conclusão': showCompletionRate ? Number((point.completionRate || 0).toFixed(1)) : undefined,
        'Total de Tentativas': showAttempts ? point.totalAttempts : undefined
    }));

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            {title && (
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    {title}
                </h3>
            )}
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: showAttempts ? 50 : 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="date" 
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                        domain={[0, 100]}
                    />
                    {showAttempts && (
                        <YAxis 
                            yAxisId="right"
                            orientation="right"
                            stroke="#64748b"
                            style={{ fontSize: '12px' }}
                        />
                    )}
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '8px'
                        }}
                        labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Line 
                        type="monotone" 
                        dataKey="Média de Notas" 
                        stroke="#6366f1" 
                        strokeWidth={2}
                        dot={{ fill: '#6366f1', r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    {showCompletionRate && (
                        <Line 
                            type="monotone" 
                            dataKey="Taxa de Conclusão" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    )}
                    {showAttempts && (
                        <Line 
                            type="monotone" 
                            dataKey="Total de Tentativas" 
                            stroke="#f59e0b" 
                            strokeWidth={2}
                            dot={{ fill: '#f59e0b', r: 4 }}
                            activeDot={{ r: 6 }}
                            yAxisId="right"
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PerformanceChart;
