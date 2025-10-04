import ServerError from "@/pages/ServerError";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { /* optional: log to Sentry, console, etc. */ }
  render() { return this.state.hasError ? <ServerError /> : this.props.children; }
}