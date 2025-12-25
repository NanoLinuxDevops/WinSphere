// Data Validation Warning System
// Provides comprehensive warning and quality assessment for lottery data

export interface ValidationWarning {
  type: 'data_quality' | 'completeness' | 'suspicious_pattern' | 'freshness' | 'statistical_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  recommendation?: string;
  affectedRows?: number[];
  qualityImpact: number; // 0-100 points deducted from quality score
}

export interface DataQualityReport {
  overallScore: number; // 0-100
  warnings: ValidationWarning[];
  recommendations: string[];
  canProceed: boolean;
  requiresUserConfirmation: boolean;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    dataCompleteness: number; // percentage
    reliabilityScore: number; // 0-100
  };
}

export class DataValidationWarningSystem {
  
  /**
   * Generate comprehensive data quality report
   */
  static generateQualityReport(
    validationResult: any,
    recordCount: number,
    totalRows: number
  ): DataQualityReport {
    const warnings: ValidationWarning[] = [];
    let overallScore = validationResult.dataQualityScore || 0;
    
    // Process validation errors as critical warnings
    if (validationResult.errors && validationResult.errors.length > 0) {
      for (const error of validationResult.errors) {
        warnings.push(this.createWarningFromError(error));
      }
    }

    // Process validation warnings
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        warnings.push(this.createWarningFromMessage(warning));
      }
    }

    // Add specific quality warnings based on metrics
    if (validationResult.validationMetrics) {
      warnings.push(...this.analyzeDataCompleteness(validationResult.validationMetrics));
      warnings.push(...this.analyzeFreshness(validationResult.validationMetrics));
      warnings.push(...this.analyzeStatisticalAnomalies(validationResult.validationMetrics));
      warnings.push(...this.analyzeSuspiciousPatterns(validationResult.validationMetrics));
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(warnings, validationResult);

    // Calculate summary metrics
    const criticalIssues = warnings.filter(w => w.severity === 'critical').length;
    const dataCompleteness = totalRows > 0 ? (recordCount / totalRows) * 100 : 0;
    const reliabilityScore = this.calculateReliabilityScore(warnings, overallScore);

    // Determine if processing can proceed
    const canProceed = criticalIssues === 0 && overallScore >= 40 && dataCompleteness >= 50;
    const requiresUserConfirmation = !canProceed || warnings.some(w => w.severity === 'high');

    return {
      overallScore,
      warnings,
      recommendations,
      canProceed,
      requiresUserConfirmation,
      summary: {
        totalIssues: warnings.length,
        criticalIssues,
        dataCompleteness,
        reliabilityScore
      }
    };
  }

  /**
   * Create warning from validation error
   */
  private static createWarningFromError(error: string): ValidationWarning {
    let type: ValidationWarning['type'] = 'data_quality';
    let severity: ValidationWarning['severity'] = 'high';
    let recommendation = 'Review and correct the data source.';

    if (error.includes('empty') || error.includes('missing')) {
      type = 'completeness';
      severity = 'critical';
      recommendation = 'Ensure the data source contains valid lottery data.';
    } else if (error.includes('HTML') || error.includes('format')) {
      type = 'data_quality';
      severity = 'critical';
      recommendation = 'Verify the data source URL and format.';
    } else if (error.includes('duplicate') || error.includes('consecutive')) {
      type = 'suspicious_pattern';
      severity = 'high';
      recommendation = 'Investigate potential data corruption or manipulation.';
    } else if (error.includes('range') || error.includes('invalid')) {
      type = 'data_quality';
      severity = 'medium';
      recommendation = 'Check data source for formatting issues.';
    }

    return {
      type,
      severity,
      message: error,
      recommendation,
      qualityImpact: this.getQualityImpact(severity)
    };
  }

  /**
   * Create warning from validation warning message
   */
  private static createWarningFromMessage(warning: string): ValidationWarning {
    let type: ValidationWarning['type'] = 'data_quality';
    let severity: ValidationWarning['severity'] = 'low';
    let recommendation = 'Monitor data quality in future updates.';

    if (warning.includes('outdated') || warning.includes('days old')) {
      type = 'freshness';
      severity = 'medium';
      recommendation = 'Consider updating to more recent data for better predictions.';
    } else if (warning.includes('small') || warning.includes('completeness')) {
      type = 'completeness';
      severity = 'medium';
      recommendation = 'Obtain more historical data for improved accuracy.';
    } else if (warning.includes('suspicious') || warning.includes('pattern')) {
      type = 'suspicious_pattern';
      severity = 'medium';
      recommendation = 'Review data source for potential issues.';
    } else if (warning.includes('frequency') || warning.includes('distribution')) {
      type = 'statistical_anomaly';
      severity = 'low';
      recommendation = 'Statistical anomalies may indicate data quality issues.';
    }

    return {
      type,
      severity,
      message: warning,
      recommendation,
      qualityImpact: this.getQualityImpact(severity)
    };
  }

  /**
   * Analyze data completeness issues
   */
  private static analyzeDataCompleteness(metrics: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (metrics.completenessRatio < 0.5) {
      warnings.push({
        type: 'completeness',
        severity: 'critical',
        message: `Very low data completeness: Only ${(metrics.completenessRatio * 100).toFixed(1)}% of rows are valid`,
        details: `${metrics.validRows} valid rows out of ${metrics.totalRows} total rows`,
        recommendation: 'Data source appears severely corrupted. Consider using a different source.',
        qualityImpact: 40
      });
    } else if (metrics.completenessRatio < 0.8) {
      warnings.push({
        type: 'completeness',
        severity: 'high',
        message: `Low data completeness: ${(metrics.completenessRatio * 100).toFixed(1)}% of rows are valid`,
        details: `${metrics.validRows} valid rows out of ${metrics.totalRows} total rows`,
        recommendation: 'Review data source for formatting or corruption issues.',
        qualityImpact: 20
      });
    } else if (metrics.completenessRatio < 0.95) {
      warnings.push({
        type: 'completeness',
        severity: 'medium',
        message: `Moderate data completeness: ${(metrics.completenessRatio * 100).toFixed(1)}% of rows are valid`,
        details: `${metrics.invalidRows} invalid rows found`,
        recommendation: 'Some data quality issues detected. Monitor for patterns.',
        qualityImpact: 10
      });
    }

    return warnings;
  }

  /**
   * Analyze data freshness
   */
  private static analyzeFreshness(metrics: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (metrics.dateRange.latest) {
      const latestDate = new Date(metrics.dateRange.latest);
      const daysSinceLatest = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLatest > 90) {
        warnings.push({
          type: 'freshness',
          severity: 'high',
          message: `Data is very outdated: Latest draw is ${Math.floor(daysSinceLatest)} days old`,
          details: `Latest draw date: ${metrics.dateRange.latest}`,
          recommendation: 'Update to more recent data for accurate predictions.',
          qualityImpact: 25
        });
      } else if (daysSinceLatest > 30) {
        warnings.push({
          type: 'freshness',
          severity: 'medium',
          message: `Data is somewhat outdated: Latest draw is ${Math.floor(daysSinceLatest)} days old`,
          details: `Latest draw date: ${metrics.dateRange.latest}`,
          recommendation: 'Consider refreshing data for better accuracy.',
          qualityImpact: 15
        });
      } else if (daysSinceLatest > 7) {
        warnings.push({
          type: 'freshness',
          severity: 'low',
          message: `Data is slightly outdated: Latest draw is ${Math.floor(daysSinceLatest)} days old`,
          details: `Latest draw date: ${metrics.dateRange.latest}`,
          recommendation: 'Data is reasonably fresh but could be updated.',
          qualityImpact: 5
        });
      }
    }

    return warnings;
  }

  /**
   * Analyze statistical anomalies
   */
  private static analyzeStatisticalAnomalies(metrics: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Number diversity analysis
    if (metrics.numberDiversity < 25) {
      warnings.push({
        type: 'statistical_anomaly',
        severity: 'medium',
        message: `Low number diversity: Only ${metrics.numberDiversity} different numbers found`,
        details: 'Expected 30+ different numbers in a healthy dataset',
        recommendation: 'Verify data completeness and check for missing draws.',
        qualityImpact: 15
      });
    }

    // Bonus diversity analysis
    if (metrics.bonusDiversity < 5) {
      warnings.push({
        type: 'statistical_anomaly',
        severity: 'medium',
        message: `Low bonus number diversity: Only ${metrics.bonusDiversity} different bonus numbers`,
        details: 'Expected 6-7 different bonus numbers in a complete dataset',
        recommendation: 'Check for missing or corrupted bonus number data.',
        qualityImpact: 10
      });
    }

    return warnings;
  }

  /**
   * Analyze suspicious patterns
   */
  private static analyzeSuspiciousPatterns(metrics: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (metrics.suspiciousPatterns > 0) {
      const patternRatio = metrics.suspiciousPatterns / metrics.validRows;
      
      if (patternRatio > 0.2) {
        warnings.push({
          type: 'suspicious_pattern',
          severity: 'high',
          message: `High number of suspicious patterns: ${metrics.suspiciousPatterns} patterns detected`,
          details: `${(patternRatio * 100).toFixed(1)}% of valid rows show suspicious patterns`,
          recommendation: 'Data may be artificially generated or corrupted. Verify authenticity.',
          qualityImpact: 30
        });
      } else if (patternRatio > 0.1) {
        warnings.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          message: `Moderate suspicious patterns: ${metrics.suspiciousPatterns} patterns detected`,
          details: `${(patternRatio * 100).toFixed(1)}% of valid rows show suspicious patterns`,
          recommendation: 'Monitor data source for potential quality issues.',
          qualityImpact: 15
        });
      } else if (metrics.suspiciousPatterns > 2) {
        warnings.push({
          type: 'suspicious_pattern',
          severity: 'low',
          message: `Some suspicious patterns detected: ${metrics.suspiciousPatterns} patterns found`,
          details: 'Patterns may be coincidental but worth monitoring',
          recommendation: 'Keep monitoring for pattern increases in future data.',
          qualityImpact: 5
        });
      }
    }

    return warnings;
  }

  /**
   * Generate actionable recommendations based on warnings
   */
  private static generateRecommendations(warnings: ValidationWarning[], validationResult: any): string[] {
    const recommendations: string[] = [];
    const warningTypes = new Set(warnings.map(w => w.type));
    const severities = warnings.map(w => w.severity);

    // Critical issues
    if (severities.includes('critical')) {
      recommendations.push('🚨 Critical data quality issues detected. Do not proceed without addressing these issues.');
      recommendations.push('Consider using a backup data source or manual data entry.');
    }

    // High severity issues
    if (severities.includes('high')) {
      recommendations.push('⚠️ Significant data quality concerns. Proceed with caution.');
      recommendations.push('Verify predictions against known results before relying on them.');
    }

    // Type-specific recommendations
    if (warningTypes.has('completeness')) {
      recommendations.push('📊 Improve data completeness by obtaining more comprehensive historical data.');
    }

    if (warningTypes.has('freshness')) {
      recommendations.push('🔄 Update data source to include more recent lottery draws.');
    }

    if (warningTypes.has('suspicious_pattern')) {
      recommendations.push('🔍 Investigate data source authenticity and integrity.');
    }

    if (warningTypes.has('statistical_anomaly')) {
      recommendations.push('📈 Review statistical distribution for potential data collection issues.');
    }

    // General recommendations
    if (validationResult.dataQualityScore < 70) {
      recommendations.push('💡 Consider implementing automated data quality monitoring.');
      recommendations.push('🔧 Set up data validation alerts for future updates.');
    }

    // Positive reinforcement
    if (warnings.length === 0) {
      recommendations.push('✅ Data quality is excellent. No issues detected.');
    } else if (severities.every(s => s === 'low')) {
      recommendations.push('✅ Data quality is good with only minor issues detected.');
    }

    return recommendations;
  }

  /**
   * Calculate reliability score based on warnings and overall score
   */
  private static calculateReliabilityScore(warnings: ValidationWarning[], overallScore: number): number {
    let reliabilityScore = overallScore;

    // Penalize based on warning severity
    for (const warning of warnings) {
      switch (warning.severity) {
        case 'critical':
          reliabilityScore -= 25;
          break;
        case 'high':
          reliabilityScore -= 15;
          break;
        case 'medium':
          reliabilityScore -= 8;
          break;
        case 'low':
          reliabilityScore -= 3;
          break;
      }
    }

    return Math.max(0, Math.min(100, reliabilityScore));
  }

  /**
   * Get quality impact score for severity level
   */
  private static getQualityImpact(severity: ValidationWarning['severity']): number {
    switch (severity) {
      case 'critical': return 30;
      case 'high': return 20;
      case 'medium': return 10;
      case 'low': return 5;
      default: return 0;
    }
  }

  /**
   * Format warnings for user display
   */
  static formatWarningsForDisplay(report: DataQualityReport): string {
    if (report.warnings.length === 0) {
      return '✅ No data quality issues detected. Data is ready for use.';
    }

    let output = `📊 Data Quality Report (Score: ${report.overallScore}/100)\n\n`;

    // Group warnings by severity
    const criticalWarnings = report.warnings.filter(w => w.severity === 'critical');
    const highWarnings = report.warnings.filter(w => w.severity === 'high');
    const mediumWarnings = report.warnings.filter(w => w.severity === 'medium');
    const lowWarnings = report.warnings.filter(w => w.severity === 'low');

    if (criticalWarnings.length > 0) {
      output += '🚨 CRITICAL ISSUES:\n';
      criticalWarnings.forEach(w => {
        output += `  • ${w.message}\n`;
        if (w.details) output += `    Details: ${w.details}\n`;
        if (w.recommendation) output += `    Action: ${w.recommendation}\n`;
      });
      output += '\n';
    }

    if (highWarnings.length > 0) {
      output += '⚠️ HIGH PRIORITY WARNINGS:\n';
      highWarnings.forEach(w => {
        output += `  • ${w.message}\n`;
        if (w.recommendation) output += `    Recommendation: ${w.recommendation}\n`;
      });
      output += '\n';
    }

    if (mediumWarnings.length > 0) {
      output += '⚡ MEDIUM PRIORITY ISSUES:\n';
      mediumWarnings.forEach(w => {
        output += `  • ${w.message}\n`;
      });
      output += '\n';
    }

    if (lowWarnings.length > 0) {
      output += 'ℹ️ MINOR ISSUES:\n';
      lowWarnings.forEach(w => {
        output += `  • ${w.message}\n`;
      });
      output += '\n';
    }

    // Add recommendations
    if (report.recommendations.length > 0) {
      output += '💡 RECOMMENDATIONS:\n';
      report.recommendations.forEach(rec => {
        output += `  ${rec}\n`;
      });
    }

    return output;
  }

  /**
   * Check if user confirmation is required before proceeding
   */
  static requiresUserConfirmation(report: DataQualityReport): boolean {
    return report.requiresUserConfirmation || 
           report.summary.criticalIssues > 0 || 
           report.overallScore < 60;
  }

  /**
   * Generate user-friendly confirmation prompt
   */
  static generateConfirmationPrompt(report: DataQualityReport): string {
    if (!this.requiresUserConfirmation(report)) {
      return '';
    }

    let prompt = '⚠️ Data Quality Concerns Detected\n\n';
    
    if (report.summary.criticalIssues > 0) {
      prompt += `${report.summary.criticalIssues} critical issue(s) found. `;
    }
    
    prompt += `Overall data quality score: ${report.overallScore}/100\n`;
    prompt += `Data completeness: ${report.summary.dataCompleteness.toFixed(1)}%\n\n`;

    if (report.canProceed) {
      prompt += 'You can proceed with predictions, but results may be less reliable.\n\n';
      prompt += 'Do you want to continue with this data?';
    } else {
      prompt += 'Data quality is too poor for reliable predictions.\n\n';
      prompt += 'Please address the critical issues before proceeding.';
    }

    return prompt;
  }
}