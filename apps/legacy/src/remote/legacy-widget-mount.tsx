import ReactDOM from 'react-dom';
import { LegacyWidget, type LegacyWidgetProps } from './legacy-widget';

export const contract = 1;

export function mount(container: Element, props?: LegacyWidgetProps) {
  ReactDOM.render(<LegacyWidget {...props} />, container);

  return () => {
    ReactDOM.unmountComponentAtNode(container);
  };
}
